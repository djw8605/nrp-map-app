const k8s = require('@kubernetes/client-node');
const geoip = require('geoip-lite');
const overrides = require('./overrides.json');
console.log(overrides);


const kc = new k8s.KubeConfig();
//kc.loadFromOptions({
//  contexts: [{
//    name
//  }]
//});
kc.loadFromDefault();
//kc.loadFromFile("../../Desktop/kubecreds/nautilus.yaml");

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

//console.log(k8sApi);

// Create the node array
var nodes = Array();

k8sApi.listNode().then((res) => {
//    console.log(res.body.items);
    res.body.items.forEach((element) => {
      //console.log(element.status.addresses);
      var node = new Object();
      element.status.addresses.forEach((address) => {
        if (address.type == "InternalIP")
          node.ip = address.address
        else if (address.type == "Hostname")
          node.hostname = address.address
      });
      node.geo = geoip.lookup(node.ip);
      nodes.push(node);
    });
//    console.log(res.body.items[0].status.addresses);

// Read in the overrides.json file

//console.log(nodes);
var reduced = reduceLocations(nodes);
console.log(reduced);
const fs = require('fs');
let data = JSON.stringify(reduced);
fs.writeFileSync('nodes.json', data);
});

function matchOverride (node) {
  // Check if the node is in the overrides regex
  console.log(node.hostname);
  overrides['overrides'].forEach((override) => {
    var regex = new RegExp(override.regex);
    if (regex.test(node.hostname)) {
      node.geo = override.geo;
      return true;
    }
  });
}

function reduceLocations (nodes) {
  var reduced = new Object();
  nodes.forEach((node) => {
    // Run the match override function
    matchOverride(node);
    if (!node.geo)
      return;
    console.log(node.geo);
    location_code = (node.geo.country ? node.geo.country : "") + "-" +
                    (node.geo.region ? node.geo.region : "") + "-" + 
                    (node.geo.city ? node.geo.city : "");
    console.log(location_code);
    if (reduced[location_code] == undefined) {
      reduced[location_code] = new Object();
      reduced[location_code].count = 1;
      reduced[location_code].geo = node.geo;
      reduced[location_code].hostnames = new Array();
      reduced[location_code].hostnames.push(node.hostname);

    }
    else {
      reduced[location_code].count += 1;
      reduced[location_code].hostnames.push(node.hostname);
    }
  });
  return reduced;
}

