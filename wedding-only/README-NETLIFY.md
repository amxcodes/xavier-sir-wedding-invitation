# Wedding-only Netlify site

Create a second Netlify site from this same GitHub repository and set its **base directory** to `wedding-only` and its **publish directory** to `.`. No build command is needed.

This site calls the same Convex attendance endpoint as the main invitation, so its guest counter remains shared. The server constrains this version to the wedding event only.

After Netlify gives you the new domain, add it to the Convex HTTP CORS allow-list with the main invitation domain.
