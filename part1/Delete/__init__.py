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
prompts_cont=config.settings['prompts_container']


def main(req: func.HttpRequest) -> func.HttpResponse:

    client = cosmos.cosmos_client.CosmosClient(db_URI, db_key)
    db_client = client.get_database_client(db_id)
    players= db_client.get_container_client(players_cont)
    prompts= db_client.get_container_client(prompts_cont)

    username=req.get_json().get('username')
    password=req.get_json().get('password')
    id=str(req.get_json().get('id'))
   
    try:
        player=players.read_item(item=username, partition_key=username)
    except:
        return func.HttpResponse(json.dumps({"result": False, "msg": "bad username or password" }))

    if(player["password"]!=password):
        return func.HttpResponse(json.dumps({"result": False, "msg": "bad username or password" }))
    
    res = prompts.query_items(query="""SELECT * FROM c
                WHERE c.username = @username """,
            parameters=[{"name" : "@username" , "value" : username}],        
            enable_cross_partition_query=True);
        
    try:
        entry=prompts.read_item(item=id, partition_key=id)
    except:
        return func.HttpResponse(json.dumps({"result": False, "msg": "prompt id does not exist" }))
    
    if(entry["username"]!=username):
        return func.HttpResponse(json.dumps({"result": False, "msg": "access denied" }))
    
    prompts.delete_item(item=id, partition_key=id)
    return func.HttpResponse(json.dumps({"result" : True, "msg": "OK" }))
 
