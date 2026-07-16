import type { HelpArticle } from './helpContentTypes';

export const faqArticle = {
  id: 'faq',
  group: 'help',
  slug: 'faq',
  path: '/help/faq',
  title: 'Frequently asked questions',
  summary: 'How this local QArefully Powder Co. demo handles browsing, checkout, and saved data.',
  blocks: [
    {
      kind: 'paragraph',
      id: 'demo-context',
      text: 'QArefully Powder Co. is a local QA demo. Its catalogue, checkout flow, and Powderizer are provided for testing and exploration.',
    },
    {
      kind: 'faq',
      id: 'demo-faq',
      heading: 'Demo FAQ',
      entries: [
        {
          id: 'shop-purpose',
          question: 'Is this a real shop?',
          answerParagraphs: [
            {
              id: 'shop-purpose-answer',
              text: 'No. This is a local QA demo with fictional catalogue content and simulated commerce.',
            },
          ],
        },
        {
          id: 'payments',
          question: 'Will my payment be charged?',
          answerParagraphs: [
            {
              id: 'payments-answer',
              text: 'No. The checkout flow simulates payment; it does not process a real charge.',
            },
          ],
        },
        {
          id: 'shipping',
          question: 'Will an order be shipped?',
          answerParagraphs: [
            {
              id: 'shipping-answer',
              text: 'No. Orders are simulated records only. No real goods are packed, dispatched, or delivered.',
            },
          ],
        },
        {
          id: 'account-data',
          question: 'What happens to account and checkout information?',
          answerParagraphs: [
            {
              id: 'account-data-answer',
              text: 'Locally supplied account, checkout, and order information is used by this demo. Use fake data rather than personal or payment information.',
            },
          ],
        },
        {
          id: 'cart',
          question: 'Is my cart saved?',
          answerParagraphs: [
            {
              id: 'cart-answer',
              text: 'The browser stores a cart identifier in local storage so the demo can reconnect to its local cart. It is not a real purchase reservation or fulfilment record.',
            },
          ],
        },
        {
          id: 'powderizer-history',
          question: 'Does Powderizer remember my mixes?',
          answerParagraphs: [
            {
              id: 'powderizer-history-answer',
              text: 'Powderizer can save a bounded history of mix configurations in this browser’s local storage. Clearing browser storage removes that local history.',
            },
          ],
        },
      ],
    },
  ],
} as const satisfies HelpArticle<'help', 'faq'>;
