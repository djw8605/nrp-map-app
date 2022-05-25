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
                "OIM_ResourceGroup": "SDSC-PRP"
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
                  "gte": "now-5y",
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
            "field": "ProjectName",
            "size": 100
          },
          "aggs": {
            "OIM_Organization": {
              "terms": {
                "field": "OIM_Organization",
                "size": 100
              },
              "aggs": {
                "OIM_FieldOfScience": {
                  "terms": {
                    "field": "OIM_FieldOfScience",
                    "size": 100
                  },
                  "aggs": {
                    "CoreHours": {
                      "sum": {
                        "field": "CoreHours"
                      }
                    },
                    "GPUHours": {
                      "sum": {
                        "field": "GPUHours"
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

  result.aggregations.projects.buckets.forEach(function (bucket) {
    try {
      var project = {
        'name': bucket.key,
        'organization': bucket.OIM_Organization.buckets[0].key,
        'fieldofscience': bucket.OIM_Organization.buckets[0].OIM_FieldOfScience.buckets[0].key,
        'usage': bucket.OIM_Organization.buckets[0].OIM_FieldOfScience.buckets[0].CoreHours.value,
        'gpuhours': bucket.OIM_Organization.buckets[0].OIM_FieldOfScience.buckets[0].GPUHours.value
      };
      projects.push(project);
    } catch (e) {
      console.log("Failed to parse project: " + bucket.key);
    }
  });
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
  res.status(200).json({ projects: projects, updateTime: Date.now() });

}