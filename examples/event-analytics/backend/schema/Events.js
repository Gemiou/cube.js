import StructuredEvent from './StructuredEvent';

const regexp = (key) => `&${key}=([^&]+)&`;
const parameters = {
  event: regexp('e'),
  true_tstamp: regexp('ttm'),
  user_fingerprint: regexp('fp'),
  se_category: regexp('se_ca'),
  se_action: regexp('se_ac'),
  page_referrer: regexp('refr'),
  page_title: regexp('page')
}

const customEvents = [
  ['Navigation', 'Menu Opened'],
  ['Navigation', 'Menu Closed']
].map(event =>
  new StructuredEvent(...event)
);

cube(`Events`, {
  sql:
  `SELECT
    from_iso8601_timestamp(to_iso8601(date) || 'T' || "time") as time,
    ${Object.keys(parameters).map((key) => ( `regexp_extract(querystring, '${parameters[key]}', 1) as ${key}` )).join(", ")}
  FROM cloudfront_logs
  WHERE length(querystring) > 1
  `,

  measures: Object.assign(customEvents.reduce((accum, event) => {
    accum[event.systemName] = {
      title: event.humanName,
      type: `count`,
      filters: [
        { sql: `${CUBE.event} = '${event.humanName}'` }
      ]
    }
    return accum
  }, {}), {
    anyEvent: {
      type: `count`,
    },

    anyEventUniq: {
      sql: `user_fingerprint`,
      type: `countDistinct`
    },

    pageView: {
      type: `count`,
      filters: [
        { sql: `${CUBE.event} = 'Page View'` }
      ]
    },

    pageViewUniq: {
      type: `countDistinct`,
      sql: `user_fingerprint`,
      filters: [
        { sql: `${CUBE.event} = 'Page View'` }
      ]
    }
  }),

  dimensions: {
    event: {
      type: `string`,
      case: {
        when: customEvents.map(e => (
          { sql: `${CUBE}.event = 'se'
                  AND ${CUBE}.se_category = '${e.categoryEscaped}'
                  AND ${CUBE}.se_action = '${e.actionEscaped}'`,
            label: e.humanName }
        )).concat([
          { sql: `${CUBE}.event = 'pv'`, label: `Page View` },
        ]),
        else: {
          label: `Unknown event`
        }
      }
    },

    referrer: {
      sql: `page_referrer`,
      type: `string`
    },

    pageTitle: {
      sql: `page_title`,
      type: `string`
    },

    time: {
      sql: `time`,
      type: `time`
    }
  }
});
