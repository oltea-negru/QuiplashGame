import logging
import json
import os

import azure.functions as func
import azure.cosmos as cosmos
import config

db_URI = config.settings['db_URI']
db_id = config.settings['db_id']
db_key = config.settings['db_key']
players_cont = config.settings['players_container']


def main(req: func.HttpRequest) -> func.HttpResponse:

    client = cosmos.cosmos_client.CosmosClient(db_URI, db_key)
    db_client = client.get_database_client(db_id)
    players= db_client.get_container_client(players_cont)
    
    username=req.get_json().get('username')
    password=req.get_json().get('password')
     
    try:
        res=players.read_item(username, partition_key=username)
    except:
        return func.HttpResponse(json.dumps({"result": False , "msg": "Username or password incorrect"}))
     
    if(res['password']!=password):
        return func.HttpResponse(json.dumps({"result": False , "msg": "Username or password incorrect"}))

    return func.HttpResponse(json.dumps({"result": True , "msg" : "OK"}))

        
