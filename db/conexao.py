import mysql.connector, os
from dotenv import load_dotenv

load_dotenv()

PASSWORD_DB = os.getenv('PASSWORD_DB')
DATABASE_DB = os.getenv('DATABASE_DB')
USER_DB = os.getenv('USER_DB')

def get_connection():
    if os.name != 'posix':
        host='192.168.1.5'
    else:
        host='10.10.10.5'

    return mysql.connector.connect(
    host = host,
    user = USER_DB,
    password = PASSWORD_DB,
    database = DATABASE_DB
)

def executar_query(query, params=None):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
            is_select = query.strip().lower().startswith("select")

            if params is None:
                cursor.execute(query)
            else:
                is_many = isinstance(params, (list, tuple)) and len(params) > 0 and isinstance(params[0], (list, tuple))
                if is_many:
                    cursor.executemany(query, params)
                else:
                    cursor.execute(query, params)

            if is_select:
                return cursor.fetchall()

            conn.commit()
            return cursor.rowcount

    finally:
        cursor.close()
        conn.close()
