## Inspiration
 Inspired by the Reddit avatars community (r/avatartrading and others!) we wanted to build a battle game for the community to use their avatars.

 ## What it does
 Allows for turn-based avatar combat. Loads enemies from the Reddit community itself to play against for true community fun and shenanigans.
 
 ## How we built it
 We used Kiro! The vast majority of code (integration with devvit, frontend scripts, backend redis variables, etc.) were written with Kiro (which was also used for test panels, debugging, and brainstorming - for test users, for example).
 We put everything together in a Unity2D frontend, allowing for true human-crafted design experiences. No art was made with AI!
 
 ## Challenges
 It definitely took some work getting all the different systems to work together (devvit with Kiro, backends with Unity).
 
 ## Accomplishments
 We got an mvp prototype working! With a Battle Selector Screen, different battle difficulties, enemy character selection and more.
 
 ## What we learned
 Working with AI code tools like Kiro is absolutely incredible for speed, but there were a few gotchas that it was handy to keep track of.
 AI Issues we encountered - Devvit specific integration, typos, overwriting old lists/code, creating new functions/not adding to old ones (search methods), getting lost at start of new session.
 Its a great tool when used properly but needs some careful thought to use well.
 
 ## Whats Next for Avatar Arena?
 More features! Think inventory system, more complex battle structure. Maybe live real-time player to player combat?
 Also testing with the active avatars community itself, for identifying features of interest to build!
 Excited to build a game and project for users who are always so actively engaged and supportive of development.
 
## Devvit React Starter

A starter to build web applications on Reddit's developer platform

- [Devvit](https://developers.reddit.com/): A way to build and deploy immersive games on Reddit
- [Vite](https://vite.dev/): For compiling the webView
- [React](https://react.dev/): For UI
- [Express](https://expressjs.com/): For backend logic
- [Tailwind](https://tailwindcss.com/): For styles
- [Typescript](https://www.typescriptlang.org/): For type safety

## Getting Started

> Make sure you have Node 22 downloaded on your machine before running!

1. Run `npm create devvit@latest --template=react`
2. Go through the installation wizard. You will need to create a Reddit account and connect it to Reddit developers
3. Copy the command on the success page into your terminal

## Commands

- `npm run dev`: Starts a development server where you can develop your application live on Reddit.
- `npm run build`: Builds your client and server projects
- `npm run deploy`: Uploads a new version of your app
- `npm run launch`: Publishes your app for review
- `npm run login`: Logs your CLI into Reddit
- `npm run check`: Type checks, lints, and prettifies your app

## Cursor Integration

This template comes with a pre-configured cursor environment. To get started, [download cursor](https://www.cursor.com/downloads) and enable the `devvit-mcp` when prompted.
# reddit_dev
