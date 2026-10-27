# ------------------------------------------------------------
# Conexión a MongoDB Atlas con PyMongo
# ------------------------------------------------------------
# La cadena de conexión NO se escribe en el código: se lee del
# archivo .env (variable MONGO_URI) para no subir la contraseña a GitHub.

import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()  # lee el archivo .env

MONGO_URI = os.getenv("MONGO_URI")
NOMBRE_BD = os.getenv("MONGO_DB", "logistica_db")

if not MONGO_URI:
    raise RuntimeError("Falta MONGO_URI en el archivo .env (copia .env.example a .env)")

# MongoClient abre la conexión con el clúster de Atlas
cliente = MongoClient(MONGO_URI, tz_aware=True)  # tz_aware: fechas con zona horaria (UTC)

# Base de datos y colección que usa todo el sistema
bd = cliente[NOMBRE_BD]
paquetes = bd["paquetes"]

# Estados posibles de un paquete (los usa la validación y la API)
ESTADOS = ["Creado", "En tránsito", "En reparto", "Entregado", "Cancelado"]
