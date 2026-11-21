# Redesigned screens

The current Founders Lab navy-and-violet interface, captured from the local production build with fictional data. Desktop viewport: 1536×1024; mobile: 393×852. Images are full-page captures.

| Screen               | Mobile                              | Desktop                               |
| -------------------- | ----------------------------------- | ------------------------------------- |
| Overview             | [Mobile](overview-mobile.png)       | [Desktop](overview-desktop.png)       |
| Founder cards        | [Mobile](founders-mobile.png)       | [Desktop](founders-desktop.png)       |
| Founder profile      | [Mobile](founder-mobile.png)        | [Desktop](founder-desktop.png)        |
| Companies            | [Mobile](companies-mobile.png)      | [Desktop](companies-desktop.png)      |
| Classification       | [Mobile](classification-mobile.png) | [Desktop](classification-desktop.png) |
| Research workspace   | [Mobile](research-mobile.png)       | [Desktop](research-desktop.png)       |
| Campaigns & awards   | [Mobile](campaigns-mobile.png)      | [Desktop](campaigns-desktop.png)      |
| Team & settings      | [Mobile](settings-mobile.png)       | [Desktop](settings-desktop.png)       |
| Spaces calendar      | [Mobile](spaces-mobile.png)         | [Desktop](spaces-desktop.png)         |
| Market map           | [Mobile](market-map-mobile.png)     | [Desktop](market-map-desktop.png)     |
| Opportunity pipeline | [Mobile](opportunities-mobile.png)  | [Desktop](opportunities-desktop.png)  |
| Reports              | [Mobile](reports-mobile.png)        | [Desktop](reports-desktop.png)        |
| Public application   | [Mobile](application-mobile.png)    | [Desktop](application-desktop.png)    |

Additional tested journeys: [approved private founder](private-founder-mobile.png), [shared recording](shared-recording-mobile.png). All records shown are fictional fixtures or isolated test submissions.

Run `npm run screenshots` while the application is running to recreate the set. `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select another server/browser. The script rejects page runtime errors and document overflow.
