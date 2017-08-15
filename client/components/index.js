// inconsistent naming-scheme for component file names, do we want camelCase?
// kebab-case? CapitalizedToStart? notCapitalizedToStart?

/**
 * `components/index.js` exists simply as a 'central export' for our components.
 * This way, we can import all of our components from the same place, rather than
 * having to figure out which file they belong to!
 */
export { default as Main } from './main';
export { default as UserHome } from './user-home';
export { Login, Signup } from './auth-form';
export { default as CurrentRecipes } from './CurrentRecipes';
export { default as Splash } from './splash';
export { default as GroceryList } from './groceryList';
export { default as RecipeHistory } from './history';
