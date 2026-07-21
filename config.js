var HubConfig = {
  // Set after deploying google-apps-script/Code.gs as a Web App.
  API_URL: '',
  // Must match ai-ascent/config.js and ai-tools-playbook/config.js (HUB_SSO_SECRET).
  HUB_SSO_SECRET: 'traininglobe-hub-sso-v1',
  // Token lifetime for handbook SSO (hours).
  HUB_SSO_HOURS: 12,
  CARDS: {
    playbook: {
      id: 'playbook',
      title: 'AI Tools Playbook',
      blurb: 'Nine tools with STAR and CREATE prompting, worked examples, and media.',
      url: 'https://biswajitchatterjee98.github.io/ai-tools-playbook/index.html',
      sso: false
    },
    ascent: {
      id: 'ascent',
      title: 'AI Ascent',
      blurb: '27-topic practical AI literacy handbook from foundations through automation.',
      url: 'https://biswajitchatterjee98.github.io/ai-ascent/index.html',
      sso: false
    },
    'hands-on': {
      id: 'hands-on',
      title: 'Hands-on Practice',
      blurb: 'Adaptive AI LMS for live practice. Opens from the hub with your cohort session.',
      url: 'https://ai-lms-delta.vercel.app/',
      sso: true
    }
  }
};
