// NOTE: Kannada strings need native-speaker proofreading
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { track } from './track'
import { ACCT } from './strings_acct'

export type Lang = 'kn' | 'en'

const CORE = {
  // Top App Bar
  brand_title: { kn: 'ಹಾಸನ ಆರೋಗ್ಯ', en: 'Hassan Health' },
  brand_subtitle: { kn: 'ಹಾಸನ ಜಿಲ್ಲಾ ಆರೋಗ್ಯ ಸೇವೆ', en: 'Hassan District Health Service' },
  helpline_chip: { kn: '108 · 1962', en: '108 · 1962' },
  pashu_helpline: { kn: '1962 ಪಶು ಸಂಜೀವಿನಿ ಸಹಾಯವಾಣಿ', en: '1962 Pashu Sanjeevini Helpline' },
  district_unit: { kn: 'ಹಾಸನ ಜಿಲ್ಲಾ ಘಟಕ', en: 'Hassan District Unit' },

  // Citizen Main SOS
  sos_human: { kn: 'ತುರ್ತು ಸಹಾಯಕ್ಕಾಗಿ ಒತ್ತಿ', en: 'Press for emergency help' },
  sos_animal: { kn: 'ಪಶು ತುರ್ತು ಸಹಾಯಕ್ಕಾಗಿ ಒತ್ತಿ', en: 'Press for livestock help' },
  sos_btn_human: { kn: 'ತುರ್ತು ಸಹಾಯ', en: 'EMERGENCY HELP' },
  sos_btn_animal: { kn: 'ಪಶು ತುರ್ತು ಸಹಾಯ', en: 'VET EMERGENCY HELP' },
  hold_btn_label: { kn: '1 ಸೆಕೆಂಡ್ ಒತ್ತಿ ಹಿಡಿಯಿರಿ', en: 'HOLD 1 SECOND' },
  hold_hint: { kn: 'ಒತ್ತಿ ಹಿಡಿಯಿರಿ', en: 'Keep holding' },
  human: { kn: 'ಮಾನವ (108)', en: 'Human (108)' },
  animal: { kn: 'ಪಶು (1962)', en: 'Livestock (1962)' },

  // Switch Banners
  switch_to_animal: { kn: 'ಪಶು ಸಹಾಯಕ್ಕೆ ಬದಲಾಯಿಸಿ', en: 'Switch to Animal Help' },
  switch_to_animal_sub: { kn: 'ಜಾನುವಾರು ಮತ್ತು ಪಶು ತುರ್ತು ಸೇವೆ', en: 'Livestock & veterinary emergency' },
  switch_btn: { kn: 'ಬದಲಾಯಿಸಿ ➔', en: 'Switch ➔' },
  switch_to_human: { kn: 'ಮಾನವ ತುರ್ತು ಸೇವೆಗೆ ಬದಲಾಯಿಸಿ (108)', en: 'Switch to Human Emergency (108)' },
  switch_to_human_sub: { kn: 'ಮಾನವ ತುರ್ತು ಸೇವೆಗೆ ತಕ್ಷಣ ಬದಲಾಯಿಸಿ', en: 'Instant human emergency dispatch' },

  // Triage Sections
  triage_human_title: { kn: 'ಆದ್ಯತೆಯ ತುರ್ತು ವರ್ಗೀಕರಣ', en: 'Priority Triage' },
  triage_human_badge: { kn: 'ನೇರ ರವಾನೆ ಟ್ಯಾಗ್', en: 'Direct Dispatch Tag' },
  triage_animal_title: { kn: 'ಪಶು ತುರ್ತು ವರ್ಗೀಕರಣ', en: 'Animal Triage' },
  triage_animal_sub: { kn: '1962 ಸಂಚಾರಿ ಪಶು ಚಿಕಿತ್ಸಾಲಯಕ್ಕೆ ವಿವರ', en: 'Details for 1962 mobile vet clinic' },

  // Triage Options
  triage_snake: { kn: 'ಹಾವು ಕಡಿತ', en: 'Snake bite' },
  triage_trauma: { kn: 'ಅಪಘಾತ', en: 'Accident / Trauma' },
  triage_maternal: { kn: 'ಹೆರಿಗೆ ತುರ್ತು', en: 'Maternal emergency' },
  triage_general: { kn: 'ಸಾಮಾನ್ಯ ತುರ್ತು', en: 'General emergency' },
  triage_animal_sick: { kn: 'ಅಸ್ವಸ್ಥ ಪ್ರಾಣಿ', en: 'Sick animal' },
  triage_animal_injury: { kn: 'ಗಾಯಗೊಂಡ ಪ್ರಾಣಿ', en: 'Injured animal' },
  triage_other: { kn: 'ಇತರೆ', en: 'Other' },
  selected_reason: { kn: 'ಆಯ್ಕೆ ಮಾಡಿದ ತುರ್ತು ಕಾರಣ:', en: 'Selected emergency reason:' },
  anonymous_notice: {
    kn: 'ಬಳಕೆಯ ವಿವರಗಳು 100% ಅನಾಮಧೇಯವಾಗಿರುತ್ತವೆ. ಯಾವುದೇ ಹೆಸರು, ಫೋನ್ ಸಂಖ್ಯೆ ಅಥವಾ ವೈಯಕ್ತಿಕ ವಿವರ ಸಂಗ್ರಹಿಸುವುದಿಲ್ಲ.',
    en: '100% Anonymous: Zero personal info, names, or phone numbers are collected or stored.'
  },
  privacy_and_info: { kn: 'ಗೌಪ್ಯತೆ ಮತ್ತು ಮಾಹಿತಿ', en: 'Privacy & Info' },
  privacy_guarantee: { kn: 'ಗೌಪ್ಯತೆ ಮತ್ತು ಮಾಹಿತಿ ಸಂರಕ್ಷಣೆ', en: 'Privacy & Data Protection' },
  triage_cattle: { kn: 'ಹಸು ಮತ್ತು ಜಾನುವಾರು', en: 'Cattle & Livestock' },
  triage_cattle_desc: { kn: 'ಕರು ಹಾಕುವ ತೊಂದರೆ, ಉಬ್ಬಸ, ಮೂಳೆ ಮುರಿತ', en: 'Calving, bloat, fracture' },
  triage_dog: { kn: 'ನಾಯಿ ಕಡಿತ ಮತ್ತು ರೇಬೀಸ್', en: 'Dog bite / Rabies' },
  triage_dog_desc: { kn: 'ರೇಬೀಸ್ ರಕ್ಷಣೆ, ನಾಯಿ ಕಡಿತ ಗಾಯ', en: 'Rabies risk, bite trauma' },
  triage_sheep: { kn: 'ಕುರಿ ಮತ್ತು ಕೋಳಿ ರೋಗ', en: 'Sheep & Poultry' },
  triage_sheep_desc: { kn: 'ಸಾಂಕ್ರಾಮಿಕ ರೋಗ, ದಿಢೀರ್ ಸಾವು', en: 'Flock outbreak, sudden mortality' },

  // Location Card
  location_title: { kn: 'ನಿಮ್ಮ ಸ್ಥಳ', en: 'Your Location' },
  approx_location_gps: { kn: 'ಅಂದಾಜು ಸ್ಥಳ - ಜಿಪಿಎಸ್ ಆನ್ ಮಾಡಿ', en: 'Approximate location - turn on GPS' },
  refresh_location: { kn: 'ಸ್ಥಳವನ್ನು ನವೀಕರಿಸಿ', en: 'Refresh location' },
  nearest_facility: { kn: 'ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ', en: 'Nearest facility' },
  nearest_vet_hospital: { kn: 'ಹತ್ತಿರದ ಪಶು ಆಸ್ಪತ್ರೆ', en: 'Nearest vet hospital' },
  call_1962: { kn: '1962 ಪಶು ಸಂಜೀವಿನಿಗೆ ಕರೆ ಮಾಡಿ', en: 'Call 1962 Pashu Sanjeevini' },

  // Active Tracking
  tracking_title: { kn: 'ಸಕ್ರಿಯ ವಾಹನ ಟ್ರ್ಯಾಕಿಂಗ್', en: 'Active Dispatch Tracking' },
  live_dispatch: { kn: 'ಸಕ್ರಿಯ ನಿಯೋಜನೆ', en: 'Live Dispatch' },
  help_on_way: { kn: 'ಸಹಾಯ ಬರುತ್ತಿದೆ. ಶಾಂತವಾಗಿರಿ.', en: 'Help is on the way. Stay calm.' },
  help_on_way_sub: { kn: 'ನಿಮ್ಮ ಸ್ಥಳಕ್ಕೆ ವಾಹನ ಹೊರಟಿದೆ.', en: 'Emergency services dispatched to your location.' },
  dispatch_progress: { kn: 'ಪ್ರಗತಿ', en: 'Dispatch Progress' },
  updated_now: { kn: 'ಈಗಷ್ಟೇ ನವೀಕರಿಸಲಾಗಿದೆ', en: 'Updated just now' },
  step_sent: { kn: 'ಕೋರಿಕೆ ಕಳುಹಿಸಲಾಗಿದೆ', en: 'Request Sent' },
  step_dispatched: { kn: 'ವಾಹನ ಹೊರಟಿದೆ', en: 'Dispatched' },
  step_arrived: { kn: 'ತಲುಪಿದೆ', en: 'Arrived' },
  call_108_btn: { kn: '108 ಗೆ ಕರೆ ಮಾಡಿ', en: 'Call 108' },
  designated_hospital: { kn: 'ನಿಗದಿಪಡಿಸಿದ ಆಸ್ಪತ್ರೆ', en: 'Designated Hospital' },
  share_link: { kn: 'ಲೈವ್ ಲಿಂಕ್ ಹಂಚಿಕೊಳ್ಳಿ', en: 'Share Live Tracking Link' },
  add_landmark: { kn: 'ಗುರುತು ಅಥವಾ ವಿವರ ಸೇರಿಸಿ', en: 'Add Condition or Landmark' },
  add_landmark_sub: { kn: 'ಉದಾ: ಬಸ್ ನಿಲ್ದಾಣದ ಹತ್ತಿರ, ಪ್ರಜ್ಞಾಹೀನ ರೋಗಿ', en: 'e.g. Near bus stand, unconscious patient' },
  landmark_added: { kn: 'ವಿವರ ಸೇರಿಸಲಾಗಿದೆ:', en: 'Landmark / Condition added:' },
  cancel_sos: { kn: 'ತುರ್ತು ವಿನಂತಿ ರದ್ದುಗೊಳಿಸಿ', en: 'Cancel Emergency Request' },

  // Doctor / Telemedicine
  doctor_on_duty: { kn: 'ಕರ್ತವ್ಯದಲ್ಲಿರುವ ವೈದ್ಯರು', en: 'Doctor on Duty' },
  doctor_desc: { kn: 'ಟೆಲಿಮೆಡಿಸಿನ್ ಮೂಲಕ ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆಯ ವೈದ್ಯರೊಂದಿಗೆ ಮಾತನಾಡಿ.', en: 'Telemedicine consultation connected to district hub.' },
  start_video_call: { kn: 'ವೀಡಿಯೊ ಕರೆ', en: 'Start Video Call' },
  demo_video_room: { kn: 'ಪ್ರಾಯೋಗಿಕ ವೀಡಿಯೊ ಕೊಠಡಿ', en: 'Demo video room' },
  start_voice_call: { kn: 'ಧ್ವನಿ ಕರೆ', en: 'Voice Call' },
  voice_call_sub: { kn: 'ಆಸ್ಪತ್ರೆ ಅಥವಾ 104 ಸಹಾಯವಾಣಿ', en: 'Facility phone or 104 helpline' },
  connected_hub: { kn: 'ಸಂಪರ್ಕಿತ ಕೇಂದ್ರ', en: 'Connected Referral Hub' },
  district_node: { kn: 'ಜಿಲ್ಲಾ ಕೇಂದ್ರ', en: 'District Node' },
  referral_chain_title: { kn: 'ಸಂಪೂರ್ಣ ರೆಫರಲ್ ದಾರಿ', en: 'View Full Hub-and-Spoke Referral Chain' },
  before_calling: { kn: 'ಕರೆ ಮಾಡುವ ಮುನ್ನ', en: 'Before Calling' },
  tap_to_check: { kn: 'ಗುರುತು ಮಾಡಲು ಒತ್ತಿ', en: 'Tap to check' },
  prep_1: { kn: 'ಹಿಂದಿನ ಮಾತ್ರೆಗಳ ಚೀಟಿ ಕೈಯಲ್ಲಿರಲಿ', en: 'Keep recent medicines/prescriptions nearby' },
  prep_1_sub: { kn: 'ಹಿಂದಿನ ಆಸ್ಪತ್ರೆಯ ದಾಖಲೆಗಳನ್ನು ಸಿದ್ಧವಾಗಿಡಿ', en: 'Keep past hospital records & strips ready' },
  prep_2: { kn: 'ಹಿಂದಿನ ಆರೋಗ್ಯ ವರದಿಗಳು ಲಭ್ಯವಿದ್ದರೆ ಇಟ್ಟುಕೊಳ್ಳಿ', en: 'Previous prescriptions or health reports if available' },
  prep_2_sub: { kn: 'ವೈದ್ಯರ ಸಮಾಲೋಚನೆಗಾಗಿ', en: 'For direct consultation review' },
  prep_3: { kn: 'ಬೆಳಕು ಮತ್ತು ಶಾಂತವಾದ ಸ್ಥಳದಲ್ಲಿ ಕುಳಿತುಕೊಳ್ಳಿ', en: 'Sit in a well-lit and quiet room' },
  prep_3_sub: { kn: 'ಸ್ಪಷ್ಟ ಕ್ಯಾಮೆರಾ ಮತ್ತು ಧ್ವನಿಗಾಗಿ', en: 'Ensures clear camera view and audio clarity' },
  offline_facility_notice: { kn: 'ಈ ಕೇಂದ್ರದಲ್ಲಿ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕವಿಲ್ಲ. ದಯವಿಟ್ಟು ಧ್ವನಿ ಕರೆ ಬಳಸಿ.', en: 'This facility has no internet connectivity. Please use voice call.' },

  // Camps
  camps_free: { kn: 'ಉಚಿತ ಸಾರ್ವಜನಿಕ ಶಿಬಿರ', en: 'Free Public Camp' },
  camps_heading: { kn: 'ಮುಂಬರುವ ಆರೋಗ್ಯ ಶಿಬಿರಗಳು', en: 'Upcoming Camps' },
  camps_subheading: { kn: 'ಸಂಚಾರಿ ಆರೋಗ್ಯ ಮತ್ತು ಪಶು ಚಿಕಿತ್ಸಾ ಶಿಬಿರಗಳು', en: 'Mobile Health & Vet Outreach Camps' },
  cannot_travel_title: { kn: 'ಶಿಬಿರಕ್ಕೆ ಬರಲು ಸಾಧ್ಯವಿಲ್ಲವೇ?', en: 'Cannot travel to camp?' },
  cannot_travel_desc: { kn: 'ಮನೆ ಬಾಗಿಲಿಗೆ ಸಂಚಾರಿ ವಾಹನ ಸೇವೆಗಾಗಿ ಸಹಾಯವಾಣಿ ಸಂಪರ್ಕಿಸಿ.', en: 'Contact helpline for doorstep mobile clinic service.' },
  remind_me: { kn: 'ನೆನಪಿಸು', en: 'Remind me' },
  reminder_saved: { kn: 'ಈ ಮೊಬೈಲ್‌ನಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ - SMS ಕಳುಹಿಸುವುದಿಲ್ಲ', en: 'Saved on this phone - no SMS is sent' },
  coming_soon: { kn: 'ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ', en: 'Coming soon' },
  whatsapp_camp_alerts: { kn: 'ವಾಟ್ಸಾಪ್ ಶಿಬಿರ ಮಾಹಿತಿ', en: 'WhatsApp Camp Alerts' },
  doorstep_clinic: { kn: 'ಮನೆ ಬಾಗಿಲಿಗೆ ಸಂಚಾರಿ ಚಿಕಿತ್ಸಾಲಯ', en: 'Doorstep mobile clinic van' },
  all_taluks: { kn: 'ಎಲ್ಲಾ ತಾಲೂಕುಗಳು', en: 'All Taluks' },
  route: { kn: 'ದಾರಿ', en: 'Route' },

  // About / Settings Sheet
  about_settings: { kn: 'ಬಗ್ಗೆ / ಸೆಟ್ಟಿಂಗ್ಸ್', en: 'About / Settings' },
  simulated_disclaimer: { kn: 'ಮಾದರಿ - ಅನುಕರಣೀಯ ಮಾಹಿತಿ', en: 'Prototype - simulated data' },
  emergency_contact: { kn: 'ತುರ್ತು ಸಂಪರ್ಕ', en: 'Emergency Contact' },
  contact_name: { kn: 'ಸಂಪರ್ಕ ವ್ಯಕ್ತಿಯ ಹೆಸರು', en: 'Contact Name' },
  contact_phone: { kn: 'ದೂರವಾಣಿ ಸಂಖ್ಯೆ', en: 'Phone Number' },
  save: { kn: 'ಉಳಿಸಿ', en: 'Save' },
  saved_on_phone: { kn: 'ಈ ಮೊಬೈಲ್‌ನಲ್ಲಿ ಮಾತ್ರ ಉಳಿಸಲಾಗಿದೆ', en: 'Saved on this phone only' },
  close: { kn: 'ಮುಚ್ಚಿ', en: 'Close' },
  language: { kn: 'ಭಾಷೆ', en: 'Language' },

  // Bottom Tabs
  tab_sos: { kn: 'ಸಹಾಯ', en: 'Help' },
  tab_map: { kn: 'ನಕ್ಷೆ', en: 'Map' },
  tab_doctor: { kn: 'ವೈದ್ಯ', en: 'Doctor' },
  tab_camps: { kn: 'ಶಿಬಿರ', en: 'Camps' },

  // Audio prompt strings (must match audio clips exactly)
  sending: { kn: 'ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ', en: 'Sending your location...' },
  dispatched: { kn: 'ಸಹಾಯ ಬರುತ್ತಿದೆ. ಶಾಂತವಾಗಿರಿ.', en: 'Help is on the way. Stay calm.' },
  logged: { kn: 'ವಿನಂತಿ ದಾಖಲಾಗಿದೆ. ಈಗಲೇ 108 ಗೆ ಕರೆ ಮಾಡಿ.', en: 'Request logged. Call 108 now.' },
  error: { kn: 'ಸಂಪರ್ಕ ವಿಫಲ. 108 ಗೆ ಕರೆ ಮಾಡಿ.', en: 'Connection failed. Call 108.' },
  map_intro: { kn: 'ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಗಳನ್ನು ನೋಡಿ', en: 'See nearby hospitals' },
  doctor_intro: { kn: 'ವೈದ್ಯರೊಂದಿಗೆ ಮಾತನಾಡಲು ಬಟನ್ ಒತ್ತಿ', en: 'Press button to talk to a doctor' },
  camps_intro: { kn: 'ಮುಂಬರುವ ಆರೋಗ್ಯ ಶಿಬಿರಗಳು', en: 'Upcoming health camps' },

  // Directory / Map Screen
  search_placeholder: { kn: 'ಆಸ್ಪತ್ರೆ, ತಾಲೂಕು ಹುಡುಕಿ...', en: 'Search hospital, taluk...' },
  all_types: { kn: 'ಎಲ್ಲವೂ', en: 'All' },
  hospitals_only: { kn: 'ಆಸ್ಪತ್ರೆಗಳು', en: 'Hospitals' },
  vets_only: { kn: 'ಪಶು ಆಸ್ಪತ್ರೆ', en: 'Vet' },
  nearby_facilities: { kn: 'ಹತ್ತಿರದ ಕೇಂದ್ರಗಳು', en: 'Nearby Facilities' },
  found: { kn: 'ಕಂಡುಬಂದಿವೆ', en: 'Found' },
  drive: { kn: 'ಪ್ರಯಾಣ', en: 'drive' },
  get_route: { kn: 'ದಾರಿ ನೋಡಿ', en: 'Get Route' },

  // Facility Types
  type_hub: { kn: 'ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ', en: 'District Hub' },
  type_chc: { kn: 'ಸಮುದಾಯ ಆರೋಗ್ಯ ಕೇಂದ್ರ', en: 'Community Health Centre' },
  type_phc: { kn: 'ಪ್ರಾಥಮಿಕ ಆರೋಗ್ಯ ಕೇಂದ್ರ', en: 'Primary Health Centre' },
  type_clinic: { kn: 'ಗ್ರಾಮ ಚಿಕಿತ್ಸಾಲಯ', en: 'Village Clinic' },
  type_vet: { kn: 'ಪಶು ಆಸ್ಪತ್ರೆ', en: 'Veterinary Hospital' },

  // General Actions
  call108: { kn: '108 ಕರೆ', en: 'Call 108' },
  call: { kn: 'ಕರೆ', en: 'Call' },
  speak: { kn: 'ಓದಿ ಹೇಳಿ', en: 'Read aloud' },
  km: { kn: 'ಕಿ.ಮೀ', en: 'km' },
  min: { kn: 'ನಿಮಿಷ', en: 'min' },
  back: { kn: 'ಹಿಂದೆ', en: 'Back' },
} as const

const S = { ...CORE, ...ACCT } as const

export type Key = keyof typeof S

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (k: Key | string) => string
}

const LangCtx = createContext<Ctx>({
  lang: 'kn',
  setLang: () => {},
  t: (k) => {
    const entry = S[k as Key]
    return entry ? entry.kn : String(k)
  },
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return (localStorage.getItem('lang') as Lang) || 'kn'
    } catch {
      return 'kn'
    }
  })
  const setLang = (l: Lang) => {
    try {
      localStorage.setItem('lang', l)
    } catch {
      // Ignore storage errors
    }
    setLangState(l)
    track('language_changed', { language: l, detail: l })
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const t = (k: Key | string): string => {
    const entry = S[k as Key]
    if (!entry) return String(k)
    return entry[lang] ?? entry.en ?? String(k)
  }

  return (
    <LangCtx.Provider
      value={{
        lang,
        setLang,
        t,
      }}
    >
      {children}
    </LangCtx.Provider>
  )
}

export const useLang = () => useContext(LangCtx)
