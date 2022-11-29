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

    username=req.get_json().get('username')
    password=req.get_json().get('password')
    addToGames = req.get_json().get('add_to_games_played')
    addToScore = req.get_json().get('add_to_score')

    if((addToGames!=None and addToGames<=0) or (addToScore!=None and addToScore<=0)):
        return func.HttpResponse(json.dumps({"result": False, "msg": "Value to add is <=0" }))
    
    if(addToScore==None):
        addToScore=0
    if(addToGames==None):
        addToGames=0

    try:
        res = players.read_item(item=username, partition_key=username)
        
        if(res["password"]!=password):
            return func.HttpResponse(json.dumps({"result": False, "msg": "wrong password" }))
        
        currentGamesPlayed = res['games_played']
        currentScore = res['total_score']
        newGamesPlayed = currentGamesPlayed + addToGames
        newScore = currentScore + addToScore
        players.upsert_item(body={"id": username, "password": password, "games_played": newGamesPlayed, "total_score": newScore})
        return func.HttpResponse(json.dumps({"result" : True, "msg": "OK" }))
    
    except exceptions.CosmosHttpResponseError as e:
        return func.HttpResponse(json.dumps({"result": False, "msg": "user does not exist" }))
 
