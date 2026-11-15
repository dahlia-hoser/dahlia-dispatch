// ─────────────────────────────────────────────────────────────
//  ALL THE WORDS ON THE SITE
//  Change any text between the quote marks, then save.
//  Leave the names on the left (like  siteName:) exactly as they are.
//  Things in {curly brackets} get filled in by the site, so keep them.
// ─────────────────────────────────────────────────────────────

export const text = {
  siteName: 'The Hosers’ Dahlia Dispatch',
  tagline: 'Dahlia tubers from small Canadian growers, all in one place.',
  byline: 'For Hosers by a Hoser',
  betaNote: 'Beta: we’re still testing, so some prices or names may be missing or wrong.',
  betaLink: 'Tell us what you think',

  // Top menu
  navSearch: 'Search',
  navCalendar: 'Sale calendar',
  navReview: 'Review list',

  // Search
  searchPlaceholder: 'Search a variety or a farm',
  searchButton: 'Search',
  suggestionVariety: 'Variety',
  suggestionFarm: 'Farm',
  suggestionAlsoSoldAs: 'also sold as',

  // Filters
  filterAvailability: 'Availability',
  filterForm: 'Form',
  filterColour: 'Colour',
  filterProvince: 'Province',
  filterAny: 'Any',
  clearFilters: 'Clear filters',
  availAll: 'All',
  availInStock: 'In stock',
  availNotAvailable: 'Not available',
  availComingSoon: 'Coming soon',
  availPriceList: 'Price list',

  // Results
  resultsCount: '{varieties} varieties at {farms} farms',
  showMore: 'Show more ({n})',
  resultsNone: 'Nothing matches yet. Try a different spelling, or clear the filters.',
  notAvailableNote:
    '“Not available” can mean sold out, or that the farm’s shop hasn’t opened for the season yet. Check the sale calendar for opening dates.',
  priceNote: 'Prices and stock from each farm’s shop, checked {time}. Always check their site in case we get it wrong!',
  visitShop: 'Visit shop',
  alsoSoldAs: 'Also sold as',
  newBadge: 'New',
  opensOn: 'Opens {date}',
  noPrice: 'Price TBA',
  cutting: 'Rooted cutting',
  listedAs: 'Listed as “{name}”',

  // Variety page
  varietyBack: '← Back to search',
  varietyFarmsHeading: 'Where to buy',
  varietyNoListings: 'No farm we follow has listed this one right now.',
  varietyColour: 'Colour',
  varietyForm: 'Form',
  varietyUnknown: 'Not set yet',
  editButton: 'Edit',

  // Calendar
  calendarTitle: 'Sale calendar',
  calendarIntro: 'When each farm opens its tuber and cutting sales. Times are Eastern unless noted.',
  calendarOpenNow: 'Open now',
  calendarComingUp: 'Coming up',
  calendarLater: 'Date not set yet',
  calendarShowAll: 'All sales',
  calendarShowFarms: 'Farms',
  calendarShowClubs: 'Clubs & societies',
  calendarFarmChip: 'Farm',
  calendarClubChip: 'Club sale',
  calendarMoreInfo: 'More info',
  calendarClubNote: 'Club and society sales are run by local dahlia growers, mostly in person, and often sell out in the first hour. Dates are based on past years until the club announces them.',

  // Footer
  footer: 'For Hosers by a Hoser. Still in beta.',
  footerFeedback: 'Send feedback',

  // Feedback page
  feedbackTitle: 'Send feedback',
  feedbackIntro: 'Spotted a wrong price, a missing farm, or a name that’s off? Ideas welcome too.',
  feedbackMessage: 'Your message',
  feedbackContact: 'Your email or name, if you’d like a reply (optional)',
  feedbackPrivacy: 'Only the person who runs this site sees your message. It’s never shown on the site or shared.',
  feedbackSend: 'Send',
  feedbackThanks: 'Thanks! Your message is on its way.',

  // Review list (only you see this)
  reviewTitle: 'Review list',
  reviewProgress: '{done} of {total}',
  reviewUndo: 'Undo last',
  reviewDoneTitle: 'All caught up.',
  reviewDoneText: 'Go enjoy your coffee.',
  reviewFarmQuestion: 'Add this farm?',
  reviewFeedback: 'Feedback',
  reviewFeedbackDone: 'Done',
  reviewNameQuestion: 'Same flower?',
  reviewDetailsQuestion: 'Colour and form',
  reviewYes: 'Yes',
  reviewNo: 'No',
  reviewLater: 'Ask me later',
  reviewSave: 'Save',
  reviewNotDahlia: 'Not a dahlia: hide it',
  reviewNewVariety: 'New variety',
  reviewGuessed: 'Filled in from the farm’s own description. Check it, then Save.',
  reviewBatchDone: 'Nice work. That’s a batch done.',
  reviewMoreWaiting: '{n} more colour questions are waiting. Do another batch now, or come back any time.',
  reviewNextBatch: 'Next batch',
};

export function fill(s: string, values: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''));
}
