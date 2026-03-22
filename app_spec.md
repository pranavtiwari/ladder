# Racquet Sports Club & Ladder App Specification

## 1. Overview
A web and mobile application to streamline the management of racquet sports (tennis, squash, badminton, pickleball, padel) clubs and competitive ladders. The app handles user memberships, ladder standings, match challenge workflows, and score recording.

## 2. User Roles
*   **Player (Member):** Can browse clubs, request to join clubs, participate in ladders, challenge other players, record match scores, and view history.
*   **Club Admin:** Can create clubs, manage memberships (approve/reject), create ladders, set ladder rules, and moderate disputes.

## 3. Core Functionality
### 3.1. Club Management
*   **Directory:** Search, discover, and filter local sports clubs.
*   **Membership:** Workflow to request access/membership to private or public clubs.
*   **Admin Tools:** Dashboard to manage the member roster and club settings.

### 3.2. Ladder System
*   **Dynamic Standings:** Visual ranking of players within a specific ladder.
*   **Ladder Rules Engine:** Support for standard bump rules (e.g., if you beat someone higher, you take their spot and they drop down one).
*   **Eligibility:** Restrictions on who players can challenge (e.g., can only challenge up to 3 spots above your current rank).

### 3.3. Match Workflow (The Loop)
1.  **Challenge:** Player A sends a challenge to Player B.
2.  **Schedule:** Players coordinate and accept the challenge.
3.  **Play & Record:** Match is played; one player inputs the final score (e.g., 6-4, 7-5).
4.  **Confirm:** The second player verifies the entered score.
5.  **Update:** Ladder auto-updates rank based on the confirmed result.

### 3.4. Actionable Dashboard (To-Do Widget)
*   A central widget on the Home page highlighting required user actions:
    *   Accept/Decline incoming match challenges.
    *   Confirm pending match scores entered by opponents.
    *   (Admins) Review pending club join requests.

## 4. Key Screens & Layouts (For UI Generation)
These core screens will form the base of the UI generated via Google Stitch.

1.  **Splash & Authentication Screen:** 
    *   Login and Registration.
2.  **Home / Dashboard:** 
    *   To-Do Widget (Action items like pending scores or challenges).
    *   "My Clubs" summary cards.
    *   Quick view of the user's current rank in active ladders.
3.  **Club Details Page:** 
    *   Club info & announcements.
    *   List of active ladders within the club.
    *   Member roster.
4.  **Ladder Standings Page:**
    *   Vertical list of players indicating rank.
    *   "Challenge" button next to eligible opponents.
    *   Recent movement indicators (up/down arrows).
5.  **Match History & Profile Page:**
    *   Player statistics (Win/Loss ratio).
    *   Log of past matches with detailed scores.
6.  **Record Match Modal / Screen:**
    *   Inputs for sets/games won.
    *   Option to add match notes.

## 5. Technical Requirements
*   **Database & Storage:** Supabase
*   **Authentication:** Google Auth for login
