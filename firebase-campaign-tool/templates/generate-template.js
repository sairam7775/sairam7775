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
    Active: 'TRUE',
  },
];

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(pushSheetData), 'PushNotifications');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(iamSheetData), 'InAppMessages');

const outPath = path.join(__dirname, 'campaign-template.xlsx');
XLSX.writeFile(workbook, outPath);
console.log(`Template written to ${outPath}`);
