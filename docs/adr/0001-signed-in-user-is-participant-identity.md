# Signed-in User is the only participant identity

when2meet lets people type a name (and optional password). Meet already has Better Auth + Keycloak, so Availability is owned by a User (Andrew ID), not a typed name. Guests must sign in before they can see or mark an Event. This is hard to reverse once Availability rows have a User foreign key, and it is surprising if you expect anonymous when2meet names.
