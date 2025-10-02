import { neon } from "@neondatabase/serverless";
import fs from "fs";

const sql = neon(process.env.DATABASE_URL);

async function exportData() {
  console.log("Starting batch data export...");
  
  let output = `-- Vespro Database Data Export
-- Generated for n8n Agent Integration
-- Database: vespro schema

SET search_path TO vespro;

`;

  try {
    // Export forms table in batches
    console.log("Exporting forms table...");
    const batchSize = 20;
    let offset = 0;
    let totalForms = 0;
    
    while (true) {
      const forms = await sql`
        SELECT * FROM vespro.forms 
        ORDER BY created_at 
        LIMIT ${batchSize} 
        OFFSET ${offset}
      `;
      
      if (forms.length === 0) break;
      
      if (offset === 0) {
        output += "-- Forms table data\n";
      }
      
      for (const form of forms) {
        const columns = Object.keys(form).join(", ");
        const values = Object.entries(form).map(([key, val]) => {
          if (val === null) return "NULL";
          if (key === 'calculated_values' || key === 'metadata' || key === 'extra') {
            return `'${JSON.stringify(val)}'::jsonb`;
          }
          if (key === 'file_data' && val !== null) {
            // Skip file_data if it's too large
            return "NULL";
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
    console.log(`Forms exported: ${totalForms} records`);

    // Export cost_items table in batches
    console.log("Exporting cost_items table...");
    offset = 0;
    let totalItems = 0;
    
    while (true) {
      const costItems = await sql`
        SELECT * FROM vespro.cost_items 
        ORDER BY item_id 
        LIMIT ${batchSize * 2} 
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
      
      offset += batchSize * 2;
      console.log(`  Processed ${totalItems} cost_items...`);
    }
    console.log(`Cost_items exported: ${totalItems} records`);

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
      console.log(`Materials exported: ${materials.length} records`);
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
      console.log(`Cost_groups exported: ${costGroups.length} records`);
    }

    // Write to file
    fs.writeFileSync('insertdata.sql', output);
    
    const stats = fs.statSync('insertdata.sql');
    console.log("\n✅ Export completed successfully!");
    console.log(`📁 File: insertdata.sql`);
    console.log(`📏 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`📝 Lines: ${output.split('\n').length}`);
    
  } catch (error) {
    console.error("Export failed:", error);
    process.exit(1);
  }
}

exportData();