function safelyParseJSON(json) {
  try {
    if (typeof json === 'object' && json !== null) {
      return json;
    }
    
    if (typeof json === 'string') {
      return JSON.parse(json);
    }
    
    return {};
  } catch (error) {
    console.error("JSON parse error:", error);
    return {};
  }
}

module.exports = {
  safelyParseJSON
};