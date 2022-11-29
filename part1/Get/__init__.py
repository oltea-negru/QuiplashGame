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
prompts_cont = config.settings['prompts_container']


def main(req: func.HttpRequest) -> func.HttpResponse:
    
    client = cosmos.cosmos_client.CosmosClient(db_URI, db_key)
    db_client = client.get_database_client(db_id)
    players= db_client.get_container_client(players_cont)
    prompts= db_client.get_container_client(prompts_cont)

    numberOfPrompts = req.get_json().get('prompts')
    usersPrompts = req.get_json().get('players')
    
    res=[]
    array=[]
    totalPrompts = prompts.query_items(query="""SELECT * FROM c""", enable_cross_partition_query=True)
    
    for entry in totalPrompts:
        array.append({"id": int(entry["id"]), "text": entry["text"], "username": entry["username"]})

    if(numberOfPrompts != None):
        if(numberOfPrompts > len(array)):
            numberOfPrompts = len(array)
            
        res=random.sample(array, numberOfPrompts)
    elif (usersPrompts != None):
        for user in usersPrompts:
            for entry in array:
                if(entry["username"] == user):
                    res.append({"id": int(entry["id"]), "text": entry["text"], "username": entry["username"]})
    return func.HttpResponse(json.dumps(res))

