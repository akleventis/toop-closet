# toop-closet

a personal clothing inventory app — browse what's in the closet, add/edit/delete items if you're logged in.

## what it does

- view all clothing items, filter by category
- add items with a name, category, and photo
- photos upload straight to s3
- login via netlify identity (just me)

## stack

- react 19 + typescript + vite
- tailwind css v4
- netlify functions for the backend
- netlify blobs for storing the inventory
- netlify identity for auth
- aws s3 for images