import json

import azure.functions as func
import azure.cosmos as cosmos
import config

db_URI = config.settings['db_URI']
db_id = config.settings['db_id']
db_key =config.settings['db_key']
players_cont = config.settings['players_container']


def main(req: func.HttpRequest) -> func.HttpResponse:
    
    client = cosmos.cosmos_client.CosmosClient(db_URI, db_key)
    db_client = client.get_database_client(db_id)
    players= db_client.get_container_client(players_cont)

    username=req.get_json().get('username')
    password=req.get_json().get('password')

    if(len(username)<4 or len(username)>16):
        return func.HttpResponse(json.dumps({"result": False, "msg": "Username less than 4 characters or more than 16 characters"}))
    if(len(password)<8 or len(password)>24):
        return func.HttpResponse(json.dumps({"result": False, "msg": "Password less than 8 characters or more than 24 characters"}))

    res = players.query_items(query="""SELECT c.id FROM c
                WHERE c.id = @username""",
            parameters=[{"name" : "@username" , "value" : username}],        
            enable_cross_partition_query=True);

    if(list(res)):
        return func.HttpResponse(json.dumps({"result": False, "msg": "Username already exists" }))
    else:
        players.create_item(body={"id": username, "password": password, "games_played": 0, "total_score": 0})
        return func.HttpResponse(json.dumps({"result" : True, "msg": "OK" }))

