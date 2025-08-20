# Security Policy

## Current Security Status

This project is a **proof-of-concept** for academic research. Security considerations:

### Local Development Only
- ⚠️ **Not intended for production deployment**
- ⚠️ **Contains development credentials** (see docker-compose.yml)
- ⚠️ **No authentication/authorization** implemented
- ✅ **Designed for local testing only**

### Known Security Considerations

#### Addressed Issues (2024-01-20)
- **Fiona CVE-2023-45853**: Updated to fiona>=1.9.6
- **Fiona CVE-2020-14152**: Updated to fiona>=1.9.6  
- **Flask-CORS vulnerabilities**: Updated to flask-cors>=4.0.1
- **orjson recursion vulnerability**: Removed orjson dependency

#### Development Security
- Database credentials are for local development only
- API runs on localhost with CORS enabled for development
- No sensitive data in repository (uses public census data)
- Docker containers run with non-root users where possible

## Production Deployment Considerations

If you deploy this beyond local development, implement:

### Essential Security Measures
1. **Authentication**: Add API key or OAuth2 authentication
2. **Database Security**: 
   - Change default passwords
   - Use connection pooling with SSL
   - Implement proper database user permissions
3. **Network Security**:
   - Disable CORS or restrict to specific domains
   - Use HTTPS only
   - Implement rate limiting
4. **Input Validation**:
   - Validate all API parameters
   - Sanitize file uploads if added
   - Implement request size limits

### Academic Research Considerations
- **Data Privacy**: Ensure compliance with institutional research ethics
- **Attribution**: Maintain proper data source attribution
- **Reproducibility**: Document exact dependency versions used in research

## Reporting Security Issues

For security concerns:
1. **Academic/Research Issues**: Contact your institutional research ethics board
2. **Technical Vulnerabilities**: Create a private issue in this repository
3. **Data Source Issues**: Follow Statistics New Zealand reporting procedures

## Dependency Management

### Philosophy
- **Research Phase**: Pin exact versions for reproducibility
- **Security Updates**: Apply manually after testing doesn't break analysis
- **Documentation**: Maintain changelog of any dependency updates that affect results

### Current Approach
```bash
# Install secure versions
pip install -r api/requirements-secure.txt

# For reproducible research
pip freeze > api/requirements-frozen.txt
```

## Legal and Compliance

### Data Sources
- **Statistics New Zealand**: Used under CC BY 4.0 license
- **OpenStreetMap**: Used under Open Database License (ODbL)
- **Google Places**: Requires separate commercial licensing for production

### Academic Use
This project is designed for academic research and educational purposes. Commercial use requires review of all data source licensing terms.

---

**Last Updated**: 2024-01-20  
**Security Review**: Local development only, not production-ready