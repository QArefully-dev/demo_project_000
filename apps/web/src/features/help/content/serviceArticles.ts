import { defineHelpArticle, type HelpArticle } from './helpContentTypes';

export const shippingArticle = defineHelpArticle({
  id: 'shipping',
  group: 'help',
  slug: 'shipping',
  path: '/help/shipping',
  title: 'Shipping',
  summary: 'Local stock, order, and delivery states are simulated for this demo.',
  blocks: [
    {
      kind: 'paragraph',
      id: 'shipping-demo-purpose',
      text: 'QArefully Powder Co. is a local QA demo. Checkout and order updates let you explore the interface, but they do not create a shipment.',
    },
    {
      kind: 'notice',
      id: 'shipping-no-fulfilment',
      heading: 'No real delivery service',
      paragraphs: [
        {
          id: 'shipping-no-fulfilment-services',
          text: 'No carrier, dispatch process, delivery estimate, or fulfilment service is connected to this demo. Tracking references and timeline updates are simulated local-demo data only. Local stock is reserved during checkout, but it does not create a real shipment.',
        },
        {
          id: 'shipping-no-fulfilment-status',
          text: 'An order status shown in the interface is simulated state only and does not mean a parcel has been sent.',
        },
      ],
    },
    {
      kind: 'section',
      id: 'shipping-simulated-tracking',
      heading: 'Simulated tracking',
      paragraphs: [
        {
          id: 'shipping-simulated-tracking-status',
          text: 'A tracking reference or shipment event appears only within an eligible order detail page. It cannot be used with a carrier and does not represent a real parcel.',
        },
        {
          id: 'shipping-simulated-tracking-changes',
          text: 'Demo administrators advance shipment states manually for testing. There are no automatic updates, carrier integrations, or delivery notifications.',
        },
      ],
    },
    {
      kind: 'section',
      id: 'shipping-testing-guidance',
      heading: 'Testing checkout',
      paragraphs: [
        {
          id: 'shipping-testing-guidance-test-data',
          text: 'Use only test information while exploring checkout. The demo tracks local stock, short-lived checkout reservations, and eligible backorders. A displayed backorder lead-time estimate is not a delivery promise, and this site is not for real-world availability or delivery planning.',
        },
      ],
    },
  ],
});

export const returnsArticle = defineHelpArticle({
  id: 'returns',
  group: 'help',
  slug: 'returns',
  path: '/help/returns',
  title: 'Returns',
  summary: 'Simulated 30-day return workflow for delivered ordinary products.',
  blocks: [
    {
      kind: 'paragraph',
      id: 'returns-demo-purpose',
      text: 'QArefully Powder Co. provides a simulated returns and refunds workflow for QA testing. All purchases, payments, and refunds are simulated only and do not represent real transactions.',
    },
    {
      kind: 'notice',
      id: 'returns-notice',
      heading: 'Simulated only — no real returns or payments',
      paragraphs: [
        {
          id: 'returns-notice-real',
          text: 'No real money, postage, carrier, or return label is involved. Refunds are local simulation records and are never processed by a payment gateway. Do not send physical items, payment details, or real return requests to anything shown in this demo.',
        },
      ],
    },
    {
      kind: 'section',
      id: 'returns-eligibility',
      heading: 'Eligibility',
      paragraphs: [
        {
          id: 'returns-eligibility-window',
          text: 'You can request a return within 30 days of an ordinary product shipment being marked as delivered. The 30-day window is measured from the exact delivery event time shown in your order timeline.',
        },
        {
          id: 'returns-eligibility-products',
          text: 'Only ordinary catalogue products are eligible. Custom Powderizer powder mixes are excluded from returns. Only delivered shipment quantities can be returned; backordered, shipped, or failed-delivery items are not eligible.',
        },
      ],
    },
    {
      kind: 'section',
      id: 'returns-workflow',
      heading: 'How it works',
      paragraphs: [
        {
          id: 'returns-workflow-request',
          text: 'From your order detail page, select the delivered items and quantities you want to return, choose a reason, and optionally add a note. Submit the request.',
        },
        {
          id: 'returns-workflow-admin',
          text: 'A demo administrator reviews your request and may approve or reject it. If approved and the items are marked as received, a simulated refund is calculated. The refund amount is based on your original purchase price and discount, prorated across returned quantities.',
        },
        {
          id: 'returns-workflow-refund',
          text: 'Once refunded, a simulated reference number appears in your return history. The refund amount is shown in your local currency format. No real funds are transferred.',
        },
      ],
    },
    {
      kind: 'section',
      id: 'returns-cancellation',
      heading: 'Returns vs cancellation',
      paragraphs: [
        {
          id: 'returns-cancellation-diff',
          text: 'Cancellation stops simulated fulfilment before shipping and releases allocated stock, but does not issue a refund. Returns apply after delivery and can result in a simulated refund when processed by an administrator. Cancellation and returns are separate workflows.',
        },
      ],
    },
  ],
});

export const packSizesArticle = defineHelpArticle({
  id: 'pack-sizes',
  group: 'help',
  slug: 'pack-sizes',
  path: '/help/pack-sizes',
  title: 'Pack sizes',
  summary: 'Local stock and backorder labels support this demo’s simulated checkout flow.',
  blocks: [
    {
      kind: 'paragraph',
      id: 'pack-sizes-display-quantity',
      text: 'Product cards and product pages show the current local-demo availability state. In-stock items have local stock available; selected products can instead be marked available to backorder.',
    },
    {
      kind: 'notice',
      id: 'pack-sizes-no-stock',
      heading: 'Local inventory, not real fulfilment',
      paragraphs: [
        {
          id: 'pack-sizes-no-stock-quantities',
          text: 'Checkout temporarily reserves local stock while payment is processed. A successful simulated order consumes reserved stock; a backordered quantity waits for a local administrator to record a stock receipt.',
        },
        {
          id: 'pack-sizes-no-stock-inventory',
          text: 'Local stock and backorder states are for testing only. They are not supplier inventory, a delivery promise, or a real fulfilment commitment.',
        },
      ],
    },
    {
      kind: 'section',
      id: 'pack-sizes-product-facts',
      heading: 'Use product-specific details',
      paragraphs: [
        {
          id: 'pack-sizes-product-facts-source',
          text: 'This guide does not restate catalog quantities or set a universal pack-size meaning. When a product displays packaging details, treat that item page as the source for its presentation.',
        },
      ],
    },
  ],
});

export const serviceArticles = [
  shippingArticle,
  returnsArticle,
  packSizesArticle,
] as const satisfies readonly HelpArticle<'help', string>[];
