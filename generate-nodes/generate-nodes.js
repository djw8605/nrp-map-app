const k8s = require('@kubernetes/client-node');
const geoip = require('geoip-lite');
const axios = require('axios');
var geohash = require('ngeohash');
const AWS = require('aws-sdk');


async function DownloadAllSites() {
  return new Promise((resolve, reject) => {
    response = axios.get('https://netbox.nrp-nautilus.io/api/dcim/sites/', {
      params: {
        limit: 10000
      },
      headers: {
        'Authorization': 'Token ' + process.env.NETBOX_TOKEN
      }
    }).then((response) => {
      //console.log(response.data.results);
      // Return a data structure map, where the key is the site id, and the value is the site object
      const sites = new Map();
      for (var i = 0; i < response.data.results.length; i++) {
        var site = response.data.results[i];
        sites.set(site.id, site);
      }
      console.log("Sites downloaded");
      resolve(sites);
    });
  });

}

async function GetNodes() {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  kc.setCurrentContext('nautilus');
  const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
  return k8sApi.listNode();

}

async function DownloadPaginatedNodes(next_url) {
  return new Promise((resolve, reject) => {
    console.log("Downloading: " + next_url);
    axios.get(next_url, {
      params: {
        limit: 10000
      },
      headers: {
        'Authorization': 'Token ' + process.env.NETBOX_TOKEN
      }
    }).then((response) => {
      console.log("Downloaded: " + next_url);
      resolve({ results: response.data.results, next: response.data.next });
    }).catch((error) => {
      console.log(error);
    });
  });
}


async function uploadToR2(data) {
  // Configure AWS SDK for Cloudflare R2  
  // Environment variables needed:
  // - CLOUDFLARE_ID: Account ID (specified in problem statement)  
  // - CLOUDFLARE_ACCESS_KEY: R2 Access Key ID (specified in problem statement)
  // - CLOUDFLARE_SECRET_ACCESS_KEY: R2 Secret Access Key (required for authentication)
  const s3 = new AWS.S3({
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
    endpoint: `https://${process.env.CLOUDFLARE_ID}.r2.cloudflarestorage.com`,
    s3ForcePathStyle: true,
    region: 'auto',
    signatureVersion: 'v4'
  });

  const params = {
    Bucket: 'nrp-dashboard',
    Key: 'nodes.json',
    Body: data,
    ContentType: 'application/json',
    ACL: 'public-read'
  };

  try {
    const result = await s3.upload(params).promise();
    console.log('Successfully uploaded nodes.json to Cloudflare R2:', result.Location);
    // If a public R2 URL is configured, construct and log the public URL for the object
    if (process.env.R2_PUBLIC_URL) {
      const publicUrl = `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/nodes.json`;
      console.log('Public URL for nodes.json:', publicUrl);
    }
    return result;
  } catch (error) {
    console.error('Error uploading to Cloudflare R2:', error);
    throw error;
  }
}

function ConvertOSGIID(osgId) {
  // Function to convert the OSGID, for example "osg-htc.org_iid_06wup3aye2t7" to https://osg-htc.org/iid/06wup3aye2t7
  if (!osgId) {
    return "";
  }
  // Convert underscore to backslash
  // prepend the "https://"
  return "https://" + osgId.replace(/_/g, '/')
}

async function ConfigureNodes() {
  // First, get all nodes
  var nodes = await GetNodes();

  // Download all the sites from Netbox
  var sites = await DownloadAllSites();

  // Loop through the nodes, getting the site information
  var node_names = new Array();
  nodes.body.items.forEach((node) => {
    // Get the hostname
    // Exclude nodes that are virtual, ie admirality virtual nodes
    if (node.metadata.labels.hasOwnProperty("type") &&
        node.metadata.labels['type'].includes("virtual-kubelet")) {
      return;
    }
    node_info = {
      name: node.metadata.name,
      cpus: node.status.capacity.cpu,
      memory: node.status.capacity.memory,
      gpus: node.metadata.labels['nvidia.com/gpu.count'] ? node.metadata.labels['nvidia.com/gpu.count'] : 0,
      gpuType: node.metadata.labels['nvidia.com/gpu.product'] ? node.metadata.labels['nvidia.com/gpu.product'] : "",
      cache: node.metadata.labels['nautilus.io/stashcache'] ? true : false,
      osgId: node.metadata.labels['nautilus.io/OSGInstitutionID'] ? ConvertOSGIID(node.metadata.labels['nautilus.io/OSGInstitutionID']) : "",
    }
    //console.log(node);
    node_names.push(node_info);
  });

  // Download all nodes from Netbox
  var response = { next: 'https://netbox-4.nrp-nautilus.io/api/dcim/devices/' }
    var results = new Array();
    while (response.next != null) {
      response = await DownloadPaginatedNodes(response.next);
      results = results.concat(response.results);
      //console.log(response);
    };
    const netbox_nodes = new Map();
    for (var i = 0; i < results.length; i++) {
      var node = results[i];
      netbox_nodes.set(node.name, node);
    }

  // For each of the node_names, merge with information from netbox_nodes
  var merged_sites = new Map();
  node_names.forEach((node_name) => {
    if (netbox_nodes.has(node_name.name)) {
      var node = netbox_nodes.get(node_name.name);
      //console.log(node);
      if (node.site) {
        if (merged_sites.has(node.site.id)) {
          merged_sites.get(node.site.id).nodes.push(node_name);
        } else {
          var site = sites.get(node.site.id);
          new_name = site.region?.name;
          if (!site.region?.name) {
            new_name = site.name;
          }
          if (!site.latitude || !site.longitude) {
            console.log("Site missing lat/long: " + site.name);
            return;
          }
          new_site = { 
            id: site.id,
            name: new_name,
            siteName: site.name,
            slug: site.slug,
            latitude: site.latitude,
            longitude: site.longitude,
            geohash: geohash.encode(site.latitude, site.longitude, 6),
            nodes: new Array()}
          new_site.nodes.push(node_name);
          merged_sites.set(node.site.id, new_site);
        }
      }
    } else {
      console.log("Node not found in Netbox: " + node_name.name);
    }
  });

  /*
  // Sort the merged_sites by geohash, combining nearby sites
  sorted_sites = Array.from(merged_sites.values()).sort((a, b) => {
    return a.geohash.localeCompare(b.geohash);
  });

  // loop through sorted_sites, combining nearby sites
  var merged_sites = new Array();
  var last_geohash = "";
  var last_site = null;
  sorted_sites.forEach((site) => {
    if (last_geohash == "") {
      last_geohash = site.geohash;
      last_site = site;
    } else if (site.geohash.startsWith(last_geohash)) {
      
      last_site.nodes = last_site.nodes.concat(site.nodes);
    } else {
      merged_sites.set(last_site.id, last_site);
      last_geohash = site.geohash;
      last_site = site;
    }
  });
  */


  //console.log(merged_sites);
  let data = JSON.stringify(Array.from(merged_sites.values()));
  
  // Upload to Cloudflare R2 instead of writing to local file
  await uploadToR2(data);
  console.log('Nodes data uploaded successfully to Cloudflare R2');

  // For each of the nodes, query netbox for the site id
  //console.log(sites);
  //console.log(nodes);
}

ConfigureNodes();
return

