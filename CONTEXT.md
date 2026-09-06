# Meet

CMU people find a time they can gather by marking availability on a shared Event.

## Language

**User**:
A signed-in CMU person, identified by Andrew ID.
_Avoid_: Account, participant

**Guest**:
An unauthenticated visitor. Not a User.
_Avoid_: anonymous user, anonymous account

**Event**:
An availability-gathering with a name, a frozen set of dates, and one daily hour range.
_Avoid_: Meeting, Poll, Meet, when2meet

**Organizer**:
The User who created an Event.
_Avoid_: owner, admin, host

**Slot**:
A 15-minute cell on an Event's grid.
_Avoid_: cell, interval, block

**Availability**:
One User's saved set of available Slots on one Event. There is at most one per User per Event.
_Avoid_: response, RSVP, vote

**Respondent**:
A User who has saved Availability on an Event, including all-unavailable.
_Avoid_: Participant, attendee

**Andrew ID**:
The User's identity and primary key, the local part of their CMU email.
