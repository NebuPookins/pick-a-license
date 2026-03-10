# Pick a License

Pick a License is a small static web app for narrowing down open source licenses by the rights, obligations, and limitations you want.

It uses metadata derived from [choosealicense.com](https://choosealicense.com/) and presents that data as:

- filterable criteria such as commercial use, patent use, warranty, and disclosure requirements
- matching licenses
- failed licenses with reasons they were excluded

## Running the App

This is a static site. Open `index.html` in a browser, or serve the directory with any simple static file server.

## Regenerating the Data

Run the generator from the project root:

```bash
node scripts/generate-data.js
```

What the script does:

1. Clones `https://github.com/github/choosealicense.com.git` into the system temp directory if it is not already present.
2. Runs `git pull --ff-only` if that checkout already exists.
3. Reads the upstream `_data/rules.yml` and `_licenses/*.txt` files.
4. Writes a fresh `data.js` file in this project.
