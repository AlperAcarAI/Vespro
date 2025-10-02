import os
import psycopg2
from psycopg2.extras import RealDictCursor
import json

# Database connection from environment
DATABASE_URL = os.environ.get('DATABASE_URL')

def escape_string(s):
    if s is None:
        return 'NULL'
    if isinstance(s, (dict, list)):
        s = json.dumps(s)
    s = str(s).replace("'", "''")
    return f"'{s}'"

def export_to_sql():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    with open('insertdata.sql', 'w') as f:
        f.write('-- Vespro Database Data Export\n')
        f.write('-- Generated for n8n Agent Integration\n\n')
        f.write('SET search_path TO vespro;\n\n')
        
        # Export forms table
        f.write('-- Forms table data\n')
        cur.execute('SELECT * FROM vespro.forms ORDER BY created_at')
        forms = cur.fetchall()
        
        for form in forms:
            columns = ', '.join(form.keys())
            values = []
            for key, val in form.items():
                if key in ['calculated_values', 'metadata', 'extra']:
                    if val:
                        values.append(f"'{json.dumps(val)}'::jsonb")
                    else:
                        values.append("'{}'::jsonb")
                elif val is None:
                    values.append('NULL')
                elif isinstance(val, (int, float)):
                    values.append(str(val))
                else:
                    values.append(escape_string(val))
            
            f.write(f"INSERT INTO vespro.forms ({columns}) VALUES ({', '.join(values)});\n")
        
        print(f"Forms exported: {len(forms)} records")
        
        # Export cost_items table
        f.write('\n-- Cost_items table data\n')
        cur.execute('SELECT * FROM vespro.cost_items ORDER BY item_id')
        items = cur.fetchall()
        
        for item in items:
            columns = ', '.join(item.keys())
            values = []
            for key, val in item.items():
                if key in ['extra']:
                    if val:
                        values.append(f"'{json.dumps(val)}'::jsonb")
                    else:
                        values.append("'{}'::jsonb")
                elif val is None:
                    values.append('NULL')
                elif isinstance(val, bool):
                    values.append('TRUE' if val else 'FALSE')
                elif isinstance(val, (int, float)):
                    values.append(str(val))
                else:
                    values.append(escape_string(val))
            
            f.write(f"INSERT INTO vespro.cost_items ({columns}) VALUES ({', '.join(values)});\n")
        
        print(f"Cost_items exported: {len(items)} records")
        
        # Export materials table (if any)
        cur.execute('SELECT * FROM vespro.materials')
        materials = cur.fetchall()
        if materials:
            f.write('\n-- Materials table data\n')
            for material in materials:
                columns = ', '.join(material.keys())
                values = []
                for key, val in material.items():
                    if val is None:
                        values.append('NULL')
                    elif isinstance(val, (int, float)):
                        values.append(str(val))
                    else:
                        values.append(escape_string(val))
                f.write(f"INSERT INTO vespro.materials ({columns}) VALUES ({', '.join(values)});\n")
            print(f"Materials exported: {len(materials)} records")
        
        # Export cost_groups table (if any)
        cur.execute('SELECT * FROM vespro.cost_groups')
        groups = cur.fetchall()
        if groups:
            f.write('\n-- Cost_groups table data\n')
            for group in groups:
                columns = ', '.join(group.keys())
                values = []
                for key, val in group.items():
                    if val is None:
                        values.append('NULL')
                    elif isinstance(val, (int, float)):
                        values.append(str(val))
                    else:
                        values.append(escape_string(val))
                f.write(f"INSERT INTO vespro.cost_groups ({columns}) VALUES ({', '.join(values)});\n")
            print(f"Cost_groups exported: {len(groups)} records")
    
    cur.close()
    conn.close()
    print("\nExport completed successfully!")
    print(f"File size: {os.path.getsize('insertdata.sql')} bytes")

if __name__ == '__main__':
    export_to_sql()