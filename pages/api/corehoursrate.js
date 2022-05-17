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
                "OIM_Facility": "Great Plains Network"
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
                  "gte": "now-1y",
                  "lt": "now"
                }
              }
            }
          ]
        }
      },
      "aggs": {
        "corehours": {
          "sum": {
            "field": "CoreHours"
          }
        }
      }
    }
  });
  console.log("Finished request to gracc.opensciencegrid.org");
  console.log(result);
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
  res.status(200).json({ corehoursrate: result.aggregations.corehours.value / (365 * 24 * 3600) });
}