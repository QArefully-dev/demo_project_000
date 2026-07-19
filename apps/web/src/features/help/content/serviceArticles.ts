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
  summary: 'This demo has no real purchases, returns, or refunds.',
  blocks: [
    {
      kind: 'paragraph',
      id: 'returns-demo-purpose',
      text: 'QArefully Powder Co. demonstrates a simulated shopping flow. It does not sell or fulfil products.',
    },
    {
      kind: 'notice',
      id: 'returns-not-available',
      heading: 'No return workflow',
      paragraphs: [
        {
          id: 'returns-not-available-workflow',
          text: 'There is no real purchase, return, refund, return window, postage process, or customer-service return workflow in this demo. Cancelling an eligible simulated order only stops its simulated fulfilment state; it does not create a refund or change its payment total.',
        },
        {
          id: 'returns-not-available-requests',
          text: 'Do not send items, payment details, or return requests in response to anything shown here.',
        },
      ],
    },
    {
      kind: 'section',
      id: 'returns-order-status',
      heading: 'Simulated order status',
      paragraphs: [
        {
          id: 'returns-order-status-simulated',
          text: 'Any checkout confirmation or order status is interface data for testing and does not create eligibility for a return or refund.',
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
