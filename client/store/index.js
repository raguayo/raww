import { createStore, combineReducers, applyMiddleware } from 'redux';
import createLogger from 'redux-logger';
import thunkMiddleware from 'redux-thunk';
import user from './user';
import prevRecipes from './prevRecipes';
import groceryList from './groceryList';

const reducer = combineReducers({ user, prevRecipes, groceryList });
const middleware = applyMiddleware(thunkMiddleware, createLogger({ collapsed: true }));
const store = createStore(reducer, middleware);

export default store;
export * from './user';
export * from './prevRecipes';
export * from './groceryList';
