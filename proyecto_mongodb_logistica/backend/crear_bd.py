# ------------------------------------------------------------
# Preparación de la base de datos en MongoDB Atlas
# ------------------------------------------------------------
# Se ejecuta UNA vez:   python crear_bd.py
# Para borrar todo y volver a cargar los datos de ejemplo:
#                       python crear_bd.py reiniciar
#
# Hace tres cosas:
#   1. Crea la colección "paquetes" con reglas de validación (Schema Validation).
#   2. Crea un índice único en tracking_id (no puede haber dos paquetes con el mismo).
#   3. Inserta paquetes de ejemplo si la colección está vacía.

import sys
from datetime import datetime, timedelta, timezone

from database import ESTADOS, bd, paquetes

# ---------- 1. Reglas de validación ($jsonSchema) ----------
# MongoDB rechaza cualquier documento que no cumpla estas reglas.
VALIDACION = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["tracking_id", "estado", "remitente", "destinatario",
                     "descripcion", "peso_kg", "historial_eventos", "total_eventos"],
        "properties": {
            "tracking_id": {"bsonType": "string", "description": "Código de rastreo"},
            "estado": {"enum": ESTADOS, "description": "Solo se aceptan los estados definidos"},
            "remitente": {  # subdocumento
                "bsonType": "object",
                "required": ["nombre", "ciudad"],
            },
            "destinatario": {  # subdocumento
                "bsonType": "object",
                "required": ["nombre", "direccion", "ciudad"],
            },
            "descripcion": {"bsonType": "string"},
            "peso_kg": {"bsonType": "number", "minimum": 0},
            "repartidor": {"bsonType": ["object", "null"]},  # puede no tener repartidor aún
            "etiquetas": {  # arreglo de textos
                "bsonType": "array",
                "items": {"bsonType": "string"},
            },
            "historial_eventos": {  # arreglo de subdocumentos
                "bsonType": "array",
                "items": {
                    "bsonType": "object",
                    "required": ["fecha", "estado", "ubicacion"],
                    "properties": {
                        "fecha": {"bsonType": "date"},
                        "estado": {"enum": ESTADOS},
                        "ubicacion": {"bsonType": "string"},
                        "comentario": {"bsonType": "string"},
                    },
                },
            },
            "total_eventos": {"bsonType": "number", "minimum": 0},
        },
    }
}


# ---------- 3. Datos de ejemplo ----------
AHORA = datetime.now(timezone.utc)


def evento(dias_atras, estado, ubicacion, comentario=""):
    """Crea un subdocumento para el arreglo historial_eventos."""
    return {
        "fecha": AHORA - timedelta(days=dias_atras),
        "estado": estado,
        "ubicacion": ubicacion,
        "comentario": comentario,
    }


def paquete(tracking_id, remitente, destinatario, descripcion, peso_kg,
            repartidor, etiquetas, historial):
    """Arma un documento de paquete completo."""
    return {
        "tracking_id": tracking_id,
        "estado": historial[-1]["estado"],  # el estado actual es el del último evento
        "remitente": remitente,
        "destinatario": destinatario,
        "descripcion": descripcion,
        "peso_kg": peso_kg,
        "repartidor": repartidor,
        "etiquetas": etiquetas,
        "historial_eventos": historial,
        "total_eventos": len(historial),
        "fecha_creacion": historial[0]["fecha"],
    }


def datos_de_ejemplo():
    return [
        paquete(
            "PKG-100001",
            {"nombre": "Tienda TecnoMax", "telefono": "5512345678", "ciudad": "CDMX"},
            {"nombre": "Laura Méndez", "telefono": "3312345678",
             "direccion": "Av. Vallarta 1200, Col. Americana", "ciudad": "Guadalajara"},
            "Laptop 15 pulgadas", 2.8,
            {"nombre": "Carlos Ramírez", "vehiculo": "Camioneta"},
            ["frágil", "electrónica", "express"],
            [
                evento(4, "Creado", "CDMX", "Orden registrada"),
                evento(3, "En tránsito", "Centro de distribución CDMX", "Salió hacia Guadalajara"),
                evento(1, "En reparto", "Guadalajara", "Asignado a ruta de entrega"),
                evento(0, "Entregado", "Guadalajara", "Recibió Laura Méndez"),
            ],
        ),
        paquete(
            "PKG-100002",
            {"nombre": "Librería El Saber", "telefono": "5598765432", "ciudad": "CDMX"},
            {"nombre": "Jorge Salinas", "telefono": "8187654321",
             "direccion": "Calle Morelos 45, Centro", "ciudad": "Monterrey"},
            "Caja con 6 libros", 4.5,
            {"nombre": "Ana Torres", "vehiculo": "Moto"},
            ["libros"],
            [
                evento(2, "Creado", "CDMX", "Orden registrada"),
                evento(1, "En tránsito", "Querétaro", "Punto de control Querétaro"),
            ],
        ),
        paquete(
            "PKG-100003",
            {"nombre": "Farmacia Salud+", "telefono": "2221112233", "ciudad": "Puebla"},
            {"nombre": "María López", "telefono": "2229998877",
             "direccion": "Blvd. 5 de Mayo 300", "ciudad": "Puebla"},
            "Medicamentos", 0.6,
            {"nombre": "Carlos Ramírez", "vehiculo": "Camioneta"},
            ["urgente", "refrigerado"],
            [
                evento(1, "Creado", "Puebla", "Orden registrada"),
                evento(0, "En reparto", "Puebla", "En camino al domicilio"),
            ],
        ),
        paquete(
            "PKG-100004",
            {"nombre": "Ropa Urbana MX", "telefono": "5544332211", "ciudad": "CDMX"},
            {"nombre": "Pedro Hernández", "telefono": "9991234567",
             "direccion": "Calle 60 #500, Centro", "ciudad": "Mérida"},
            "2 playeras y 1 sudadera", 1.2,
            None,  # todavía no tiene repartidor asignado
            ["ropa"],
            [evento(0, "Creado", "CDMX", "Orden registrada")],
        ),
        paquete(
            "PKG-100005",
            {"nombre": "Electrónica Norte", "telefono": "8111223344", "ciudad": "Monterrey"},
            {"nombre": "Sofía Castillo", "telefono": "6141239876",
             "direccion": "Av. Universidad 800", "ciudad": "Chihuahua"},
            "Televisión 50 pulgadas", 15.0,
            {"nombre": "Luis Gómez", "vehiculo": "Camión"},
            ["frágil", "electrónica"],
            [
                evento(5, "Creado", "Monterrey", "Orden registrada"),
                evento(4, "En tránsito", "Saltillo", "Punto de control Saltillo"),
                evento(3, "En tránsito", "Torreón", "Retraso por clima"),
                evento(1, "En reparto", "Chihuahua", "Asignado a ruta de entrega"),
            ],
        ),
        paquete(
            "PKG-100006",
            {"nombre": "Dulces Típicos Oaxaca", "telefono": "9511234567", "ciudad": "Oaxaca"},
            {"nombre": "Roberto Díaz", "telefono": "5576543210",
             "direccion": "Insurgentes Sur 1500", "ciudad": "CDMX"},
            "Caja de dulces", 3.0,
            None,
            ["alimentos"],
            [evento(0, "Creado", "Oaxaca", "Orden registrada")],
        ),
        paquete(
            "PKG-100007",
            {"nombre": "Tienda TecnoMax", "telefono": "5512345678", "ciudad": "CDMX"},
            {"nombre": "Fernanda Ruiz", "telefono": "4421234567",
             "direccion": "Av. Constituyentes 20", "ciudad": "Querétaro"},
            "Audífonos inalámbricos", 0.4,
            {"nombre": "Ana Torres", "vehiculo": "Moto"},
            ["electrónica"],
            [
                evento(6, "Creado", "CDMX", "Orden registrada"),
                evento(5, "Cancelado", "CDMX", "El cliente canceló la compra"),
            ],
        ),
        paquete(
            "PKG-100008",
            {"nombre": "Papelería Escolar", "telefono": "4771234567", "ciudad": "León"},
            {"nombre": "Diego Morales", "telefono": "4779876543",
             "direccion": "Blvd. López Mateos 2000", "ciudad": "León"},
            "Material escolar", 2.0,
            {"nombre": "Luis Gómez", "vehiculo": "Camión"},
            ["escolar"],
            [
                evento(3, "Creado", "León", "Orden registrada"),
                evento(2, "En reparto", "León", "En camino al domicilio"),
                evento(1, "En reparto", "León", "Imprevisto: nadie en casa, se reintenta mañana"),
                evento(0, "Entregado", "León", "Entregado en recepción"),
            ],
        ),
    ]


# ---------- Ejecución ----------
if __name__ == "__main__":
    # 1. Crear la colección con validación (o actualizar la validación si ya existe)
    if "paquetes" in bd.list_collection_names():
        bd.command("collMod", "paquetes", validator=VALIDACION)
        print("Validación actualizada en la colección 'paquetes'")
    else:
        bd.create_collection("paquetes", validator=VALIDACION)
        print("Colección 'paquetes' creada con validación")

    # 2. Índice único para el código de rastreo
    #    (si ya existía un índice normal en tracking_id, se cambia por uno único)
    indices = paquetes.index_information()
    if "tracking_id_1" in indices and not indices["tracking_id_1"].get("unique"):
        paquetes.drop_index("tracking_id_1")
    paquetes.create_index("tracking_id", unique=True)
    print("Índice único en tracking_id listo")

    # 3. Datos de ejemplo
    if len(sys.argv) > 1 and sys.argv[1] == "reiniciar":
        borrados = paquetes.delete_many({})
        print(f"Se borraron {borrados.deleted_count} paquetes")

    if paquetes.count_documents({}) == 0:
        resultado = paquetes.insert_many(datos_de_ejemplo())
        print(f"Se insertaron {len(resultado.inserted_ids)} paquetes de ejemplo")
    else:
        print("La colección ya tiene datos, no se insertó nada")
