# ------------------------------------------------------------
# API REST del sistema de logística (FastAPI + PyMongo)
# ------------------------------------------------------------
# Para correrla (desde la carpeta backend):
#     uvicorn main:app --reload
# Luego abrir http://localhost:8000  (página web)
#          o http://localhost:8000/docs (documentación automática de la API)

import random
import re
import string
from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from database import ESTADOS, paquetes

app = FastAPI(title="Sistema de Logística y Rastreo")


# ---------- Modelos: qué datos recibe la API ----------
class Remitente(BaseModel):
    nombre: str
    telefono: str = ""
    ciudad: str


class Destinatario(BaseModel):
    nombre: str
    telefono: str = ""
    direccion: str
    ciudad: str


class Repartidor(BaseModel):
    nombre: str
    vehiculo: str = ""


class DatosPaquete(BaseModel):
    """Datos que se capturan al crear o editar un paquete."""
    remitente: Remitente
    destinatario: Destinatario
    descripcion: str
    peso_kg: float = Field(gt=0)
    repartidor: Repartidor | None = None
    etiquetas: list[str] = []


class NuevoEvento(BaseModel):
    """Un punto de control: el paquete pasó por un lugar y cambió de estado."""
    estado: str
    ubicacion: str
    comentario: str = ""


# ---------- Funciones de apoyo ----------
def a_json(doc):
    """Convierte el _id (ObjectId) a texto para poder mandarlo como JSON."""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


def id_valido(id):
    """Revisa que el id tenga formato de ObjectId; si no, responde 404."""
    if not ObjectId.is_valid(id):
        raise HTTPException(404, "Paquete no encontrado")
    return ObjectId(id)


def nuevo_tracking_id():
    """Genera un código de rastreo como PKG-4F7K2Q."""
    return "PKG-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


# =============================================================
# C - CREAR:  POST /api/paquetes   ->  insert_one
# =============================================================
@app.post("/api/paquetes", status_code=201)
def crear_paquete(datos: DatosPaquete):
    ahora = datetime.now(timezone.utc)
    documento = datos.model_dump()  # convierte el modelo a diccionario
    documento["tracking_id"] = nuevo_tracking_id()
    documento["estado"] = "Creado"
    documento["fecha_creacion"] = ahora
    # El historial empieza con un primer evento (arreglo de subdocumentos)
    documento["historial_eventos"] = [{
        "fecha": ahora,
        "estado": "Creado",
        "ubicacion": datos.remitente.ciudad,
        "comentario": "Orden registrada",
    }]
    documento["total_eventos"] = 1

    resultado = paquetes.insert_one(documento)
    return {"mensaje": "Paquete creado", "_id": str(resultado.inserted_id),
            "tracking_id": documento["tracking_id"]}


# =============================================================
# R - CONSULTAR (módulo de administración):
#     GET /api/paquetes?buscar=...&estado=...&repartidor=...  ->  find
# =============================================================
@app.get("/api/paquetes")
def listar_paquetes(
    buscar: str = "",
    estado: list[str] = Query(default=[]),
    repartidor: str = "",
):
    filtro = {}

    # Barra de búsqueda: busca el texto en varios campos con $regex ("contiene", sin
    # importar mayúsculas). $or = basta con que coincida en uno de los campos.
    if buscar:
        texto = {"$regex": re.escape(buscar), "$options": "i"}
        filtro["$or"] = [
            {"tracking_id": texto},
            {"destinatario.nombre": texto},   # campo dentro de un subdocumento
            {"destinatario.ciudad": texto},
            {"descripcion": texto},
            {"etiquetas": texto},             # busca dentro del arreglo
        ]

    # Filtro por estado: $in = el estado está dentro de la lista elegida
    if estado:
        filtro["estado"] = {"$in": estado}

    # Filtro por nombre del repartidor (subdocumento)
    if repartidor:
        filtro["repartidor.nombre"] = repartidor

    # Proyección: del historial solo mandamos el último evento ($slice: -1)
    proyeccion = {"historial_eventos": {"$slice": -1}}

    cursor = paquetes.find(filtro, proyeccion).sort("fecha_creacion", -1)
    return [a_json(doc) for doc in cursor]


# =============================================================
# R - CONSULTAR (módulo de cliente):
#     GET /api/rastreo/{tracking_id}  ->  find_one por tracking_id
# =============================================================
@app.get("/api/rastreo/{tracking_id}")
def rastrear(tracking_id: str):
    # Proyección: el cliente solo ve lo necesario (sin teléfonos ni dirección)
    proyeccion = {
        "_id": 0,
        "tracking_id": 1,
        "estado": 1,
        "descripcion": 1,
        "destinatario.nombre": 1,
        "destinatario.ciudad": 1,
        "repartidor.nombre": 1,
        "historial_eventos": 1,
    }
    doc = paquetes.find_one({"tracking_id": tracking_id.strip().upper()}, proyeccion)
    if not doc:
        raise HTTPException(404, "No existe un paquete con ese código de rastreo")
    return doc


# Lista de repartidores para el filtro del administrador (distinct = valores sin repetir)
@app.get("/api/repartidores")
def listar_repartidores():
    return sorted(n for n in paquetes.distinct("repartidor.nombre") if n)


# =============================================================
# U - ACTUALIZAR datos del paquete:
#     PUT /api/paquetes/{id}   ->  update_one con $set
# =============================================================
@app.put("/api/paquetes/{id}")
def editar_paquete(id: str, datos: DatosPaquete):
    resultado = paquetes.update_one(
        {"_id": id_valido(id)},
        {"$set": datos.model_dump()},  # $set reemplaza solo los campos indicados
    )
    if resultado.matched_count == 0:
        raise HTTPException(404, "Paquete no encontrado")
    return {"mensaje": "Paquete actualizado"}


# =============================================================
# U - AGREGAR EVENTO al historial (punto de control):
#     PUT /api/paquetes/{id}/evento  ->  update_one con $push, $set y $inc
# =============================================================
@app.put("/api/paquetes/{id}/evento")
def agregar_evento(id: str, evento: NuevoEvento):
    if evento.estado not in ESTADOS or evento.estado == "Creado":
        raise HTTPException(400, "Estado no válido")

    nuevo = {
        "fecha": datetime.now(timezone.utc),
        "estado": evento.estado,
        "ubicacion": evento.ubicacion,
        "comentario": evento.comentario,
    }
    resultado = paquetes.update_one(
        # Solo paquetes que sigan activos ($nin = "no está en la lista")
        {"_id": id_valido(id), "estado": {"$nin": ["Entregado", "Cancelado"]}},
        {
            "$push": {"historial_eventos": nuevo},  # agrega el evento al final del arreglo
            "$set": {"estado": evento.estado},       # cambia el estado general
            "$inc": {"total_eventos": 1},            # suma 1 al contador de eventos
        },
    )
    if resultado.matched_count == 0:
        raise HTTPException(400, "El paquete no existe o ya fue entregado/cancelado")
    return {"mensaje": f"Evento agregado: {evento.estado}"}


# =============================================================
# D - ELIMINAR:  DELETE /api/paquetes/{id}  ->  delete_one
#     Regla: solo se eliminan órdenes en estado "Creado" (aún no despachadas)
# =============================================================
@app.delete("/api/paquetes/{id}")
def eliminar_paquete(id: str):
    resultado = paquetes.delete_one({"_id": id_valido(id), "estado": "Creado"})
    if resultado.deleted_count == 0:
        raise HTTPException(400, "Solo se pueden eliminar paquetes en estado 'Creado'")
    return {"mensaje": "Paquete eliminado"}


# ---------- Página web (frontend) ----------
# Se sirve la carpeta frontend en la raíz: http://localhost:8000
CARPETA_FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=CARPETA_FRONTEND, html=True), name="frontend")
