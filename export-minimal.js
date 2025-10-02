import { neon } from "@neondatabase/serverless";
import fs from "fs";

const sql = neon(process.env.DATABASE_URL);

async function exportData() {
  console.log("Starting minimal data export (without file_data)...");
  
  let output = `-- Vespro Database Data Export
-- Generated for n8n Agent Integration  
-- Database: vespro schema
-- Note: file_data column excluded due to size constraints

SET search_path TO vespro;

`;

  try {
    // Export forms table without file_data column
    console.log("Exporting forms table (without file_data)...");
    const batchSize = 10;
    let offset = 0;
    let totalForms = 0;
    
    while (true) {
      const forms = await sql`
        SELECT 
          form_id, form_code, client_name, form_title, form_date, revision_no, 
          currency, tank_name, tank_type, tank_width_mm, tank_height_mm, 
          tank_diameter_mm, tank_volume, tank_surface_area, tank_material_type, 
          tank_material_grade, operating_pressure, operating_temperature, 
          drawing_revision, project_status, calculated_values, notes, 
          metadata, original_filename, created_at
        FROM vespro.forms 
        ORDER BY created_at 
        LIMIT ${batchSize} 
        OFFSET ${offset}
      `;
      
      if (forms.length === 0) break;
      
      if (offset === 0) {
        output += "-- Forms table data (file_data excluded)\n";
      }
      
      for (const form of forms) {
        // Add file_data as NULL to maintain column structure
        const extendedForm = { ...form, file_data: null };
        const columns = Object.keys(extendedForm).join(", ");
        const values = Object.entries(extendedForm).map(([key, val]) => {
          if (val === null) return "NULL";
          if (key === 'calculated_values' || key === 'metadata') {
            return `'${JSON.stringify(val)}'::jsonb`;
          }
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (typeof val === 'number') return val;
          if (val instanceof Date) return `'${val.toISOString()}'`;
          // Escape single quotes in strings
          const escaped = String(val).replace(/'/g, "''");
          return `'${escaped}'`;
        }).join(", ");
        
        output += `INSERT INTO vespro.forms (${columns}) VALUES (${values});\n`;
        totalForms++;
      }
      
      offset += batchSize;
      console.log(`  Processed ${totalForms} forms...`);
    }
    console.log(`✓ Forms exported: ${totalForms} records`);

    // Export cost_items table in smaller batches
    console.log("Exporting cost_items table...");
    offset = 0;
    let totalItems = 0;
    const itemBatchSize = 50;
    
    while (true) {
      const costItems = await sql`
        SELECT * FROM vespro.cost_items 
        ORDER BY item_id 
        LIMIT ${itemBatchSize} 
        OFFSET ${offset}
      `;
      
      if (costItems.length === 0) break;
      
      if (offset === 0) {
        output += "\n-- Cost_items table data\n";
      }
      
      for (const item of costItems) {
        const columns = Object.keys(item).join(", ");
        const values = Object.entries(item).map(([key, val]) => {
          if (val === null) return "NULL";
          if (key === 'extra') {
            return `'${JSON.stringify(val)}'::jsonb`;
          }
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (typeof val === 'number') return val;
          if (val instanceof Date) return `'${val.toISOString()}'`;
          // Escape single quotes in strings
          const escaped = String(val).replace(/'/g, "''");
          return `'${escaped}'`;
        }).join(", ");
        
        output += `INSERT INTO vespro.cost_items (${columns}) VALUES (${values});\n`;
        totalItems++;
      }
      
      offset += itemBatchSize;
      if (totalItems % 200 === 0) {
        console.log(`  Processed ${totalItems} cost_items...`);
      }
    }
    console.log(`✓ Cost_items exported: ${totalItems} records`);

    // Export materials table
    console.log("Exporting materials table...");
    const materials = await sql`SELECT * FROM vespro.materials`;
    
    if (materials.length > 0) {
      output += "\n-- Materials table data\n";
      for (const material of materials) {
        const columns = Object.keys(material).join(", ");
        const values = Object.entries(material).map(([key, val]) => {
          if (val === null) return "NULL";
          if (typeof val === 'number') return val;
          const escaped = String(val).replace(/'/g, "''");
          return `'${escaped}'`;
        }).join(", ");
        
        output += `INSERT INTO vespro.materials (${columns}) VALUES (${values});\n`;
      }
      console.log(`✓ Materials exported: ${materials.length} records`);
    } else {
      console.log("✓ Materials table is empty");
    }

    // Export cost_groups table
    console.log("Exporting cost_groups table...");
    const costGroups = await sql`SELECT * FROM vespro.cost_groups`;
    
    if (costGroups.length > 0) {
      output += "\n-- Cost_groups table data\n";
      for (const group of costGroups) {
        const columns = Object.keys(group).join(", ");
        const values = Object.entries(group).map(([key, val]) => {
          if (val === null) return "NULL";
          if (typeof val === 'number') return val;
          const escaped = String(val).replace(/'/g, "''");
          return `'${escaped}'`;
        }).join(", ");
        
        output += `INSERT INTO vespro.cost_groups (${columns}) VALUES (${values});\n`;
      }
      console.log(`✓ Cost_groups exported: ${costGroups.length} records`);
    } else {
      console.log("✓ Cost_groups table is empty");
    }

    // Write to file
    fs.writeFileSync('insertdata.sql', output);
    
    const stats = fs.statSync('insertdata.sql');
    console.log("\n✅ Export completed successfully!");
    console.log(`📁 File: insertdata.sql`);
    console.log(`📏 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`📝 Lines: ${output.split('\n').length}`);
    
  } catch (error) {
    console.error("Export failed:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

exportData();