import logging
import json

import azure.functions as func
import azure.cosmos as cosmos
import azure.cosmos.exceptions as exceptions
import config
import random

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
    prompt=req.get_json().get('text')

    if(len(prompt)<20 or len(prompt)>100):
        return func.HttpResponse(json.dumps({"result": False, "msg": "prompt length is <20 or > 100 characters" }))
   
    try:
        player=players.read_item(item=username, partition_key=username)
    except:
        return func.HttpResponse(json.dumps({"result": False, "msg": "bad username or password" }))

    if(player["password"]!=password):
        return func.HttpResponse(json.dumps({"result": False, "msg": "bad username or password" }))

    # try:
    try:
        test = prompts.query_items(
        query = """SELECT TOP 1 * FROM c
            ORDER BY c.id DESC""",     
        enable_cross_partition_query=True                
        )
        id=int(list(test)[0]["id"])+1
  
    except:
        id=0
    
    res = prompts.query_items(query="""SELECT * FROM c
                WHERE c.username = @username """,
            parameters=[{"name" : "@username" , "value" : username}],        
            enable_cross_partition_query=True);
    
    for entry in list(res):
        if(entry["text"]==prompt):
            return func.HttpResponse(json.dumps({"result": False, "msg": "This user already has a prompt with the same text" }))
        
    prompts.create_item(body={"username": username, "text": prompt,"id": str(id)})
    return func.HttpResponse(json.dumps({"result" : True, "msg": "OK" }))
 
