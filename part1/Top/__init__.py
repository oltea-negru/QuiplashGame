import logging
import json

import azure.functions as func
import azure.cosmos as cosmos
import azure.cosmos.exceptions as exceptions
import config

db_URI = config.settings['db_URI']
db_id = config.settings['db_id']
db_key = config.settings['db_key']
players_cont = config.settings['players_container']


def main(req: func.HttpRequest) -> func.HttpResponse:
    
    client = cosmos.cosmos_client.CosmosClient(db_URI, db_key)
    db_client = client.get_database_client(db_id)
    players= db_client.get_container_client(players_cont)

    top=req.get_json().get('top')

    query_result = players.query_items(
            query = """SELECT TOP @number * FROM c
                ORDER BY c.total_score DESC, c.id ASC""",
            parameters=[{"name" : "@number" , "value" : top}],     
            enable_cross_partition_query=True                
            )
    
    res=[]
    
    for entry in query_result:
        res.append({"username": entry["id"], "score": entry["total_score"], "games": entry["games_played"]})

    return func.HttpResponse(json.dumps(res))
 



