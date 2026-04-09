const puppeteer = require('puppeteer');

(async () => {
  try {
    console.log("Launching puppeteer...");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // We navigate to the club page first or directly to a ladder view page.
    // Wait, we need a valid ladder ID. Let's log all errors.
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));

    console.log("Navigating...");
    await page.goto('http://localhost:5174/', { waitUntil: 'networkidle2' });
    
    // We probably need to sign in and click a ladder to trigger the error, 
    // because the URL is typically /clubs/:id/ladder/:ladderId
    console.log("Closing browser.");
    await browser.close();
  } catch (error) {
    console.log("PUPPETEER EXCEPTION:", error);
  }
})();
