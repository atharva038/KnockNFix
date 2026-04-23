const fs = require('fs');
const path = require('path');

const mappings = {
    // public
    "'pages/home'": "'pages/public/home'",
    "'pages/aboutUs'": "'pages/public/aboutUs'",
    "'pages/contact'": "'pages/public/contact'",
    "'pages/services'": "'pages/public/services'",
    "'pages/service'": "'pages/public/service'",
    "'pages/providers'": "'pages/public/providers'",
    "'pages/registerService'": "'pages/public/registerService'",

    // auth
    "'pages/login'": "'pages/auth/login'",
    "'pages/register'": "'pages/auth/register'",
    "'pages/forgot-password'": "'pages/auth/forgot-password'",
    "'pages/reset-password'": "'pages/auth/reset-password'",
    "'pages/verify-otp'": "'pages/auth/verify-otp'",

    // booking
    "'pages/booking'": "'pages/booking/index'",
    "'pages/booking-confirm'": "'pages/booking/confirm'",
    "'pages/booking-details'": "'pages/booking/details'",
    "'pages/my-bookings'": "'pages/booking/my-bookings'",

    // payment
    "'pages/payment-success'": "'pages/payment/success'",
    "'pages/success'": "'pages/payment/status'",

    // support
    "'pages/chatbot'": "'pages/support/chatbot'",
    "'pages/complaints'": "'pages/support/complaints'",
    "'pages/feedback'": "'pages/support/feedback'",

    // dashboards
    "'pages/customerDashboard'": "'pages/customer/dashboard'",
    "'pages/providerDashboard'": "'pages/provider/dashboard'"
};

// Also support double quotes
const doubleMappings = {};
for (const [key, value] of Object.entries(mappings)) {
    doubleMappings[key.replace(/'/g, '"')] = value.replace(/'/g, '"');
}
// Also support backticks
const backtickMappings = {};
for (const [key, value] of Object.entries(mappings)) {
    backtickMappings[key.replace(/'/g, '`')] = value.replace(/'/g, '`');
}

const allMappings = { ...mappings, ...doubleMappings, ...backtickMappings };

function walkSync(dir, callback, extension) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);
        if (stat.isDirectory()) {
            walkSync(filepath, callback, extension);
        } else if (filepath.endsWith(extension)) {
            callback(filepath);
        }
    }
}

// 1. Refactor JS files in controllers/ and routes/
const jsDirs = [
    path.join(__dirname, 'controllers'),
    path.join(__dirname, 'routes'),
    path.join(__dirname, 'app.js'),
    path.join(__dirname, 'index.js')
];

jsDirs.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    if (fs.statSync(dir).isFile()) {
        processJsFile(dir);
        return;
    }
    walkSync(dir, processJsFile, '.js');
});

function processJsFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    let changed = false;
    for (const [oldPath, newPath] of Object.entries(allMappings)) {
        if (content.includes(oldPath)) {
            content = content.split(oldPath).join(newPath);
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Updated res.render paths in ${filepath}`);
    }
}

// 2. Refactor EJS includes in views/pages
// All files in views/pages/* are now one level deeper, so we must replace:
// include('../components/  => include('../../components/
// include('../includes/  => include('../../includes/
// include('../layouts/  => include('../../layouts/
// include('./  => include('../

const pagesDir = path.join(__dirname, 'views', 'pages');
walkSync(pagesDir, processEjsFile, '.ejs');

function processEjsFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    let changed = false;

    // This handles basic string replacements for common paths
    const includeReplacements = [
        { from: "include('../components/", to: "include('../../components/" },
        { from: 'include("../components/', to: 'include("../../components/' },
        { from: "include('../includes/", to: "include('../../includes/" },
        { from: 'include("../includes/', to: 'include("../../includes/' },
        { from: "include('../layouts/", to: "include('../../layouts/" },
        { from: 'include("../layouts/', to: 'include("../../layouts/' },
        
        // Sometimes they do <%- include('partials/header') %> - we don't have partials dir but just in case
    ];

    for (const r of includeReplacements) {
        if (content.includes(r.from)) {
            content = content.split(r.from).join(r.to);
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Updated EJS includes in ${filepath}`);
    }
}

console.log("Refactoring complete.");
