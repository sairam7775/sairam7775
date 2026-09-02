const path = require('path');
const XLSX = require('xlsx');

const pushSheetData = [
  {
    Topic: 'promo_users',
    Title: 'Weekend Sale!',
    Body: 'Get 20% off all items this weekend only.',
    ImageURL: 'https://example.com/images/sale.png',
    Data: '{"deepLink":"app://promo/weekend-sale"}',
    Priority: 'high',
  },
];

const iamSheetData = [
  {
    Key: 'weekend-sale-banner',
    Title: 'Weekend Sale',
    Body: 'Tap to see 20% off deals before they end.',
    ImageURL: 'https://example.com/images/sale-banner.png',
    CTAText: 'Shop Now',
    CTAUrl: 'app://promo/weekend-sale',
    Condition: '',
    CampaignId: '',
    Style: 'banner',
    StartDate: '',
    EndDate: '',
    Active: 'TRUE',
  },
  {
    Key: 'mumbai-store-launch',
    Title: 'We just opened in Mumbai!',
    Body: 'Visit our new store and get 15% off your first purchase.',
    ImageURL: 'https://example.com/images/mumbai-launch.png',
    CTAText: 'Get Directions',
    CTAUrl: 'https://example.com/stores/mumbai',
    Condition: 'India Users',
    CampaignId: 'mumbai-launch-2026',
    Style: 'modal',
    StartDate: '2026-09-10T09:00:00Z',
    EndDate: '2026-09-17T23:59:59Z',
    Active: 'TRUE',
  },
];

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(pushSheetData), 'PushNotifications');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(iamSheetData), 'InAppMessages');

const outPath = path.join(__dirname, 'campaign-template.xlsx');
XLSX.writeFile(workbook, outPath);
console.log(`Template written to ${outPath}`);
