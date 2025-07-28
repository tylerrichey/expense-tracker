import { databaseService } from './database.js';

/**
 * Simple SQLite database admin interface
 * Provides basic CRUD operations through REST endpoints
 */

export function setupAdminRoutes(app, authenticateRequest) {
  // Admin UI - serves a simple HTML interface (authentication required)
  app.get('/admin', authenticateRequest, (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SQLite Database Admin</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
    .section { margin: 20px 0; }
    .tables-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 20px 0; }
    .table-card { background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px solid #ddd; cursor: pointer; transition: background 0.2s; }
    .table-card:hover { background: #e9ecef; }
    .query-section { margin: 20px 0; }
    textarea { width: 100%; height: 100px; font-family: monospace; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
    button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px; }
    button:hover { background: #0056b3; }
    button.danger { background: #dc3545; }
    button.danger:hover { background: #c82333; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f8f9fa; font-weight: bold; }
    tr:nth-child(even) { background: #f9f9f9; }
    .result-container { max-height: 400px; overflow: auto; margin: 20px 0; }
    .error { color: #dc3545; background: #f8d7da; padding: 10px; border-radius: 4px; margin: 10px 0; }
    .success { color: #155724; background: #d4edda; padding: 10px; border-radius: 4px; margin: 10px 0; }
    .row-count { color: #666; font-size: 0.9em; margin: 10px 0; }
    .query-examples { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 10px 0; }
    .query-examples h4 { margin-top: 0; }
    .example-query { background: white; padding: 8px; margin: 5px 0; border-radius: 3px; font-family: monospace; cursor: pointer; border: 1px solid #ddd; }
    .example-query:hover { background: #e9ecef; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h1>🗄️ SQLite Database Admin</h1>
      <div>
        <span style="color: #28a745; margin-right: 15px;">✓ Authenticated</span>
        <button onclick="logout()" style="background: #dc3545;">Logout</button>
      </div>
    </div>
    
    <div class="section">
      <h2>Database Tables</h2>
      <div id="tables-container">
        <button onclick="loadTables()">Load Tables</button>
      </div>
    </div>
    
    <div class="section query-section">
      <h2>SQL Query</h2>
      <div class="query-examples">
        <h4>Example Queries (click to use):</h4>
        <div class="example-query" onclick="setQuery('SELECT * FROM expenses ORDER BY timestamp DESC LIMIT 10')">Recent 10 expenses</div>
        <div class="example-query" onclick="setQuery('SELECT * FROM budgets WHERE is_active = 1')">Active budgets</div>
        <div class="example-query" onclick="setQuery('SELECT * FROM budget_periods ORDER BY start_date DESC LIMIT 5')">Recent budget periods</div>
        <div class="example-query" onclick="setQuery('SELECT COUNT(*) as expense_count, SUM(amount) as total_amount FROM expenses')">Expense summary</div>
        <div class="example-query" onclick="setQuery('SELECT name as table_name, sql FROM sqlite_master WHERE type=\\'table\\'')">Show table schemas</div>
      </div>
      <textarea id="query" placeholder="Enter your SQL query here..."></textarea>
      <div>
        <button onclick="executeQuery()">Execute Query</button>
        <button onclick="clearQuery()">Clear</button>
        <button class="danger" onclick="confirmQuery()">Execute with Confirmation</button>
      </div>
    </div>
    
    <div id="results-container"></div>
  </div>

  <script>
    // Session storage for admin token (fallback when localStorage is blocked)
    let adminToken = null;
    
    // Get auth token from localStorage or session variable
    function getAuthToken() {
      // First try session variable
      if (adminToken) return adminToken;
      
      // Then try localStorage
      try {
        const token = localStorage.getItem('expense-tracker-token');
        if (token) {
          adminToken = token; // Cache it
          return token;
        }
      } catch (error) {
        console.warn('localStorage access blocked:', error);
      }
      
      return null;
    }
    
    // Prompt user for password and authenticate
    async function promptForAuthentication() {
      const password = prompt('Please enter your application password to access the admin panel:');
      if (!password) return false;
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        
        const result = await response.json();
        if (response.ok && result.token) {
          adminToken = result.token; // Store in session variable
          return true;
        } else {
          alert('Authentication failed: ' + (result.error || 'Invalid password'));
          return false;
        }
      } catch (error) {
        alert('Authentication error: ' + error.message);
        return false;
      }
    }
    
    // Check if user is authenticated, prompt if not
    async function checkAuth() {
      const token = getAuthToken();
      if (!token) {
        return await promptForAuthentication();
      }
      return true;
    }
    
    // Make authenticated request
    async function makeAuthenticatedRequest(url, options = {}) {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) return null;
      
      const token = getAuthToken();
      const headers = {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        ...options.headers
      };
      
      return fetch(url, { ...options, headers });
    }
    
    async function loadTables() {
      try {
        const response = await makeAuthenticatedRequest('/admin/api/tables');
        if (!response) return;
        
        if (response.status === 401) {
          alert('Authentication expired. Please log in to the main application again.');
          window.location.href = '/';
          return;
        }
        
        const tables = await response.json();
        
        let html = '<div class="tables-list">';
        tables.forEach(table => {
          html += '<div class="table-card" onclick="loadTableData(\'' + table.name + '\')">' +
            '<strong>' + table.name + '</strong>' +
            '<div style="font-size: 0.9em; color: #666; margin-top: 5px;">' +
            'Click to view data' +
            '</div>' +
            '</div>';
        });
        html += '</div>';
        
        document.getElementById('tables-container').innerHTML = html;
      } catch (error) {
        showError('Error loading tables: ' + error.message);
      }
    }
    
    async function loadTableData(tableName) {
      setQuery('SELECT * FROM ' + tableName + ' LIMIT 100');
      executeQuery();
    }
    
    function setQuery(query) {
      document.getElementById('query').value = query;
    }
    
    function clearQuery() {
      document.getElementById('query').value = '';
      document.getElementById('results-container').innerHTML = '';
    }
    
    async function executeQuery() {
      const query = document.getElementById('query').value.trim();
      if (!query) {
        showError('Please enter a query');
        return;
      }
      
      try {
        const response = await makeAuthenticatedRequest('/admin/api/query', {
          method: 'POST',
          body: JSON.stringify({ query })
        });
        
        if (!response) return;
        
        if (response.status === 401) {
          alert('Authentication expired. Please log in to the main application again.');
          window.location.href = '/';
          return;
        }
        
        const result = await response.json();
        
        if (!response.ok) {
          showError(result.error || 'Query failed');
          return;
        }
        
        displayResults(result, query);
      } catch (error) {
        showError('Error executing query: ' + error.message);
      }
    }
    
    function confirmQuery() {
      const query = document.getElementById('query').value.trim();
      if (!query) {
        showError('Please enter a query');
        return;
      }
      
      if (confirm('Are you sure you want to execute this query?\\n\\n' + query)) {
        executeQuery();
      }
    }
    
    function displayResults(result, query) {
      const container = document.getElementById('results-container');
      
      if (result.type === 'select') {
        if (result.data.length === 0) {
          container.innerHTML = '<div class="success">Query executed successfully. No rows returned.</div>';
          return;
        }
        
        let html = '<div class="row-count">Returned ' + result.data.length + ' rows</div>';
        html += '<div class="result-container"><table>';
        
        // Headers
        const headers = Object.keys(result.data[0]);
        html += '<tr>';
        headers.forEach(header => {
          html += '<th>' + header + '</th>';
        });
        html += '</tr>';
        
        // Rows
        result.data.forEach(row => {
          html += '<tr>';
          headers.forEach(header => {
            let value = row[header];
            if (value === null) value = '<em>NULL</em>';
            else if (typeof value === 'string' && value.length > 100) {
              value = value.substring(0, 100) + '...';
            }
            html += '<td>' + value + '</td>';
          });
          html += '</tr>';
        });
        
        html += '</table></div>';
        container.innerHTML = html;
      } else {
        // Non-select query (INSERT, UPDATE, DELETE, etc.)
        container.innerHTML = '<div class="success">' +
          'Query executed successfully.<br>' +
          'Changes: ' + result.changes + '<br>' +
          'Last Insert Row ID: ' + (result.lastInsertRowid || 'N/A') +
          '</div>';
      }
      }
    }
    
    function showError(message) {
      document.getElementById('results-container').innerHTML = '<div class="error">' + message + '</div>';
    }
    
    function logout() {
      // Clear session token
      adminToken = null;
      
      // Try to clear localStorage if accessible
      try {
        localStorage.removeItem('expense-tracker-token');
      } catch (error) {
        console.warn('Could not clear localStorage:', error);
      }
      
      alert('Logged out successfully. Redirecting to main application.');
      window.location.href = '/';
    }
    
    // Check authentication and load tables on page load
    window.onload = async function() {
      const isAuthenticated = await checkAuth();
      if (isAuthenticated) {
        loadTables();
      }
    };
  </script>
</body>
</html>
    `;
    
    res.send(html);
  });

  // API endpoint to get all tables (authentication required)
  app.get('/admin/api/tables', authenticateRequest, (req, res) => {
    try {
      const tables = databaseService.db.prepare(`
        SELECT name, sql 
        FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all();
      
      res.json(tables);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // API endpoint to execute queries (authentication required)
  app.post('/admin/api/query', authenticateRequest, (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }
      
      // Check if it's a SELECT query
      const isSelect = query.trim().toLowerCase().startsWith('select');
      
      if (isSelect) {
        const result = databaseService.db.prepare(query).all();
        res.json({
          type: 'select',
          data: result
        });
      } else {
        // For non-SELECT queries (INSERT, UPDATE, DELETE, etc.)
        const result = databaseService.db.prepare(query).run();
        res.json({
          type: 'modification',
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowid
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}