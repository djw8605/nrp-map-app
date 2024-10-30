Instructions for generating nodes
=================================

Requirements:

1. A netbox token (Read-only is fine)
2. Access to kubernetes

Steps:
1. NETBOX_TOKEN=your_token_here node generate-nodes.js
2. cp nodes.json ../data/nodes.json
3. git add ../data/nodes.json
4. git commit -m "Update nodes.json"



