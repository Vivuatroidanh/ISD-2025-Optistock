require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  let connection;
  
  try {
    // First connect without specifying database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true // Enable multiple statements
    });
    
    console.log('Connected to MySQL server');
    
    // Drop database if exists and create a new one
    await connection.query('DROP DATABASE IF EXISTS inventory_system');
    console.log('Dropped existing database (if it existed)');
    
    await connection.query('CREATE DATABASE IF NOT EXISTS inventory_system');
    console.log('Database created successfully');
    
    // Use the inventory_system database
    await connection.query('USE inventory_system');
    console.log('Using inventory_system database');
    
    // Read SQL script
    const sqlScript = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    
    // Remove DELIMITER commands and process triggers specially
    let processedSQL = sqlScript
      .replace(/DELIMITER\s+\/\//gi, '')
      .replace(/DELIMITER\s+;/gi, '')
      .replace(/\/\//g, ';'); // Replace // with ;
    
    // Split into statements, but be careful with triggers
    const statements = [];
    let currentStatement = '';
    let inTrigger = false;
    
    processedSQL.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      
      // Check if we're entering a trigger
      if (trimmedLine.toUpperCase().includes('CREATE TRIGGER')) {
        inTrigger = true;
        currentStatement = line + '\n';
        return;
      }
      
      // If in trigger, accumulate lines
      if (inTrigger) {
        currentStatement += line + '\n';
        
        // Check if trigger ends (END; or END;;)
        if (trimmedLine === 'END;' || trimmedLine === 'END;;') {
          statements.push(currentStatement.trim());
          currentStatement = '';
          inTrigger = false;
        }
        return;
      }
      
      // Normal SQL processing
      currentStatement += line + '\n';
      
      // If line ends with semicolon and we're not in a trigger, it's a complete statement
      if (trimmedLine.endsWith(';') && !inTrigger) {
        const statement = currentStatement.trim();
        if (statement.length > 0 && 
            !statement.toUpperCase().includes('DROP DATABASE') && 
            !statement.toUpperCase().includes('CREATE DATABASE') &&
            !statement.toUpperCase().startsWith('USE INVENTORY_SYSTEM')) {
          statements.push(statement);
        }
        currentStatement = '';
      }
    });
    
    // Add any remaining statement
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.length === 0) continue;
      
      // Skip problematic statements
      if (statement.toUpperCase().includes('USE INVENTORY_SYSTEM') ||
          statement.toUpperCase().includes('DROP DATABASE') ||
          statement.toUpperCase().includes('CREATE DATABASE')) {
        console.log('Skipping: ' + statement.substring(0, 50) + '...');
        continue;
      }
      
      try {
        await connection.query(statement);
        
        // Show shortened output for better readability
        const preview = statement.length > 80 
          ? statement.substring(0, 80).replace(/\n/g, ' ') + '...' 
          : statement.replace(/\n/g, ' ');
        console.log(`✓ Executed: ${preview}`);
      } catch (err) {
        // Only show error for important failures
        if (!err.message.includes('already exists') && 
            !err.message.includes('Duplicate')) {
          console.error(`✗ Error executing statement:`);
          console.error(`  ${statement.substring(0, 100).replace(/\n/g, ' ')}...`);
          console.error(`  Error: ${err.message}`);
        }
      }
    }
    
    console.log('\n=================================');
    console.log('Database setup completed successfully');
    console.log('=================================\n');
    
    // Verify data was inserted
    const [materials] = await connection.query('SELECT COUNT(*) as count FROM materials');
    console.log(`✓ Inserted ${materials[0].count} materials into the database`);
    
    const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
    console.log(`✓ Inserted ${users[0].count} users into the database`);
    
    const [machines] = await connection.query('SELECT COUNT(*) as count FROM machines');
    console.log(`✓ Inserted ${machines[0].count} machines into the database`);
    
    const [molds] = await connection.query('SELECT COUNT(*) as count FROM molds');
    console.log(`✓ Inserted ${molds[0].count} molds into the database`);
    
    const [batches] = await connection.query('SELECT COUNT(*) as count FROM batches');
    console.log(`✓ Inserted ${batches[0].count} batches into the database`);
    
    // Check if triggers were created
    const [triggers] = await connection.query(`
      SELECT TRIGGER_NAME 
      FROM information_schema.TRIGGERS 
      WHERE TRIGGER_SCHEMA = 'inventory_system'
    `);
    console.log(`✓ Created ${triggers.length} triggers`);
    
    console.log('\n✓ Database is ready to use!');
    
  } catch (error) {
    console.error('✗ Error setting up database:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✓ Database connection closed');
    }
  }
}

// Run the setup
setupDatabase();