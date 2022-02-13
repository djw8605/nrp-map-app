const { Client } = require('@elastic/elasticsearch')
const client = new Client({ node: 'https://gracc.opensciencegrid.org' })


export default async function handler(req, res) {
  // Example output
  console.log("Starting request to gracc.opensciencegrid.org");
  const result = await client.transport.request({
    method: 'POST',
    path: '/q/gracc.osg.summary/_search',
    body: {
      "query": {
        "bool": {
          "filter": [
            {
              "term": {
                "OIM_Site": "GP-ARGO"
              }
            },
            {
              "term": {
                "ResourceType": "Payload"
              }
            }
          ],
          "must": [
            {
              "range": {
                "EndTime": {
                  "gte": "now-6M",
                  "lt": "now"
                }
              }
            }
          ]
        }
      },
      "aggs": {
        "projects": {
          "terms": {
            "field": "ProjectName"
          },
          "aggs": {
            "OIM_Organization": {
              "terms": {
                "field": "OIM_Organization"
              },
              "aggs": {
                "OIM_NSFFieldOfScience": {
                  "terms": {
                    "field": "OIM_NSFFieldOfScience"
                  },
                  "aggs": {
                    "CoreHours": {
                      "sum": {
                        "field": "CoreHours"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
  console.log("Finished request to gracc.opensciencegrid.org");
  //console.log(result);
  //console.log(result.aggregations.buckets);
  var projects = new Array();

  result.aggregations.projects.buckets.forEach(function(bucket) {
    var project = {
      'name': bucket.key,
      'organization': bucket.OIM_Organization.buckets[0].key,
      'fieldofscience': bucket.OIM_Organization.buckets[0].OIM_NSFFieldOfScience.buckets[0].key,
      'usage': bucket.OIM_Organization.buckets[0].OIM_NSFFieldOfScience.buckets[0].CoreHours.value,
    };
    projects.push(project);
  });
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
  res.status(200).json({ projects: projects });

}