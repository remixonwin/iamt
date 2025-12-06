/**
 * File Upload UX Diagnostic Script
 * 
 * Run this in the browser console on https://iamt.vercel.app to diagnose
 * why files don't appear in "My Files" after upload.
 * 
 * Instructions:
 * 1. Open https://iamt.vercel.app
 * 2. Open browser console (F12 → Console)
 * 3. Paste this entire script and press Enter
 * 4. The script will output diagnostic information
 */

console.log('=== IAMT File Upload Diagnostic ===\n');

// 1. Check Gun.js initialization
console.log('1. Checking Gun.js localStorage...');
try {
    const lsKeys = Object.keys(localStorage);
    const gunKeys = lsKeys.filter(k => k.includes('gun') || k.includes('iamt'));
    console.log(`   Found ${gunKeys.length} Gun.js keys in localStorage`);
    console.log(`   Keys:`, gunKeys.slice(0, 5)); // Show first 5
} catch (e) {
    console.error('   LocalStorage check failed:', e);
}

// 2. Check if Gun.js database is accessible
console.log('\n2. Checking Gun.js database...');
try {
    // Try to access Gun from window
    if (typeof Gun !== 'undefined') {
        console.log('   ✓ Gun is available globally');
    } else {
        console.log('   ✗ Gun is NOT available globally (expected for module)');
    }
} catch (e) {
    console.error('   Error:', e);
}

// 3. Check current file list in localStorage
console.log('\n3. Checking stored files...');
try {
    const gunData = Object.keys(localStorage)
        .filter(k => k.includes('gun'))
        .map(k => {
            try {
                return { key: k, value: JSON.parse(localStorage.getItem(k)) };
            } catch {
                return { key: k, value: localStorage.getItem(k) };
            }
        });

    console.log(`   Total Gun.js entries: ${gunData.length}`);

    // Look for file-related data
    const fileEntries = gunData.filter(d =>
        JSON.stringify(d.value).toLowerCase().includes('file') ||
        JSON.stringify(d.value).toLowerCase().includes('name')
    );
    console.log(`   Potential file entries: ${fileEntries.length}`);

    if (fileEntries.length > 0) {
        console.log('   Sample file entry:', fileEntries[0]);
    }
} catch (e) {
    console.error('   Error checking stored files:', e);
}

// 4. Check React state (if accessible via React DevTools)
console.log('\n4. Checking React component state...');
console.log('   (Use React DevTools to inspect component state)');

// 5. Monitor Gun.js operations
console.log('\n5. Setting up Gun.js operation monitor...');
const originalConsoleLog = console.log;
let gunOperations = [];

// Intercept Gun.js logs
const monitoredConsole = (...args) => {
    const message = args.join(' ');
    if (message.includes('[Gun.js]') || message.includes('[GunSEA]')) {
        gunOperations.push({ time: new Date().toISOString(), message });
    }
    originalConsoleLog.apply(console, args);
};

console.log = monitoredConsole;
console.log('   ✓ Monitor active - Gun.js operations will be tracked');
console.log('   Run this to see tracked operations: gunOperations');

// 6. Create a test function to simulate upload
console.log('\n6. Test upload function created:');
console.log('   Run: testFileUpload() to simulate a file upload\n');

window.testFileUpload = function () {
    console.log('[TEST] Starting test file upload...');

    // Create a test file
    const testContent = `Test file created at ${new Date().toISOString()}`;
    const testBlob = new Blob([testContent], { type: 'text/plain' });
    const testFile = new File([testBlob], `test_${Date.now()}.txt`, { type: 'text/plain' });

    console.log('[TEST] Created test file:', testFile.name, `(${testFile.size} bytes)`);

    // Find file input
    const fileInput = document.querySelector('input[type="file"]');

    if (!fileInput) {
        console.error('[TEST] ✗ File input not found!');
        return;
    }

    console.log('[TEST] ✓ Found file input element');

    // Simulate file selection
    try {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(testFile);
        fileInput.files = dataTransfer.files;

        // Trigger change event
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);

        console.log('[TEST] ✓ Triggered file upload');
        console.log('[TEST] Watch console for Gun.js operations...');

        // Check after 5 seconds
        setTimeout(() => {
            console.log('[TEST] Checking results after 5 seconds...');
            console.log('[TEST] Gun operations captured:', gunOperations.length);
            gunOperations.forEach(op => console.log('  ', op.message));
        }, 5000);

    } catch (e) {
        console.error('[TEST] ✗ Failed to trigger upload:', e);
    }
};

// 7. Create a function to check "My Files" tab
window.checkMyFiles = function () {
    console.log('[CHECK] Checking My Files tab...');

    // Try to find and click "My Files" tab
    const tabs = Array.from(document.querySelectorAll('button'));
    const myFilesTab = tabs.find(btn => btn.textContent.includes('My Files'));

    if (myFilesTab) {
        console.log('[CHECK] ✓ Found "My Files" tab button');
        const fileCount = myFilesTab.textContent.match(/\d+/);
        console.log(`[CHECK] File count shown: ${fileCount ? fileCount[0] : 'unknown'}`);

        // Click the tab
        myFilesTab.click();
        console.log('[CHECK] ✓ Clicked "My Files" tab');

        // Check for files after a delay
        setTimeout(() => {
            const fileCards = document.querySelectorAll('[class*="file"], [class*="card"]');
            console.log(`[CHECK] Found ${fileCards.length} potential file elements`);
        }, 1000);
    } else {
        console.error('[CHECK] ✗ "My Files" tab not found');
    }
};

console.log('=== Diagnostic Complete ===');
console.log('\nAvailable test commands:');
console.log('  - testFileUpload()     : Simulate uploading a file');
console.log('  - checkMyFiles()       : Check My Files tab');
console.log('  - gunOperations        : View tracked Gun.js operations');
console.log('\nNow try uploading a file manually and watch the console!');
