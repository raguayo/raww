const router = require('express').Router();
const axios = require('axios');
const { Recipe, Ingredient, IngredientQuantity, SavedRecipe } = require('../db/models');
import { mapToPeapod } from '../../peapod/mapToPeapod';
const Promise = require('bluebird');

module.exports = router;

router.param('url', (req, res, next, url) => {
  if (url === 'chrome') next()
  else {
    Recipe.findOne({ where: { recipeUrl: url } })
    .then((recipe) => {
      if (!recipe) {
        const formattedUrl = url.replace(':', '%3A').replace('/', '%2F');
        return axios.get(`/recipes/extract?forceExtraction=false&url=${formattedUrl}`, {
          baseURL: 'https://spoonacular-recipe-food-nutrition-v1.p.mashape.com',
          headers: { 'X-Mashape-Key': process.env.RECIPE_API_KEY },
        })
        .then(response => response.data)
        .catch(next);
      }
      return recipe;
    })
    .then((recipe) => {
      req.recipe = recipe;
      next();
    })
    .catch(next);
  }
});

router.get('/', (req, res, next) => {
  req.user.getSavedRecipes()
  .then(recipesWithFlag => res.json(recipesWithFlag))
  .catch(next);
});

router.get('/:url', (req, res, next) => {
  res.json(req.recipe);
});

router.post('/:url', (req, res, next) => {
  let recipePromise = Promise.resolve();
  let ingredientArr;
  let inGroceryList = true;

  if (req.body.isFromChromeExt) {
    req.recipe = req.body.recipe;
    inGroceryList = req.body.inGroceryList === 'true';
  }
  // console.log('IN route', req.recipe)
  if (req.recipe.extendedIngredients) {
    // if it's from the API, then we need to add it to the database
    const { title, sourceUrl, imageUrls, servings } = req.recipe;
    recipePromise = Recipe.findOrCreate({
      where: {
        recipeUrl: sourceUrl,
      },
      defaults: {
        title,
        imageUrl: imageUrls[0],
        numServings: servings,
      },
    });

    ingredientArr = req.recipe.extendedIngredients;

    recipePromise = Promise.all([recipePromise, ...ingredientArr])
      .then(([recipeArr, ...arrIngredients]) => {
        const newRecipe = recipeArr[0];
        req.recipe = newRecipe;
        const isCreated = recipeArr[1];

        if (isCreated) {
          const arrOfIngIds = [];
          return Promise.each(arrIngredients, (ingredient) => {
            if (ingredient.unit === '') ingredient.unit = 'piece';
            return Ingredient.findOrCreate({
              where: {
                name: ingredient.name,
              },
              defaults: {
                unitMeasure: ingredient.unit,
                aisle: ingredient.aisle,
              },
            })
              .then(([foundIngredient, ingIsCreated]) => {
                let peapodPromise;

                if (ingIsCreated) {
                  peapodPromise = mapToPeapod(foundIngredient);
                }
                return Promise.all([foundIngredient, peapodPromise])
              })
              .then(([createdIngredient, peapodIngredient]) => {
                arrOfIngIds.push(createdIngredient.id);
                if (peapodIngredient) createdIngredient.setPeapodIngredient(peapodIngredient[0]);
                return IngredientQuantity.create({ recipeId: newRecipe.id, ingredientId: createdIngredient.id, quantity: ingredient.amount })
                  .catch(next);
              })
              .catch(next);
          })
            .then(() => newRecipe.addIngredients(arrOfIngIds))
            .then(() => newRecipe)
            .catch(next);
        } else {
          console.error('Error: API was called for already existing recipe');
        }
      })
      .catch(next);
  }

  recipePromise.then(() => {
    let savedRecipePromise = null;
    let groceryListRecipePromise = null;

    if (req.recipe.id) {
      savedRecipePromise = req.user.addSavedRecipe(req.recipe.id);
      if (inGroceryList) {
        groceryListRecipePromise = req.user.addGroceryListRecipe(req.recipe.id);
      }
    } else {
      savedRecipePromise = req.user.addSavedRecipe(req.recipe);
      if (inGroceryList) {
        groceryListRecipePromise = req.user.addGroceryListRecipe(req.recipe);
      }
    }

    return Promise.all([savedRecipePromise, groceryListRecipePromise]);
  })
  .then(([savedRecipe, groceryListRecipe]) => {
    if (groceryListRecipe) {
      return Promise.all([req.user.getSavedRecipes(), req.user.getGroceryListRecipes()]);
    }
    return Promise.all([req.user.getSavedRecipes(), null])
  })
  .then(([savedRecipe, groceryListRecipe]) => {
    if (groceryListRecipe) {
      res.status(201).json({ savedRecipe, groceryListRecipe });
    } else {
      res.status(201).json({ savedRecipe });
    }
  })
  .catch(next);
});

router.put('/:id/favorite', (req, res, next) => {
  const recipeId = req.params.id;
  const userId = req.user.id;

  SavedRecipe.findOne({ where: { userId, recipeId } })
    .then((recipe) => {
      if (recipe.isFavorite) {
        return recipe.update({ isFavorite: false });
      }
      return recipe.update({ isFavorite: true });
    })
    .then(() => req.user.getSavedRecipes({ where: { id: recipeId } }))
    .then((recipe) => {
      res.json(recipe[0]);
    })
    .catch(next);
});

router.put('/:id', (req, res, next) => {
  Recipe.findById(req.params.id)
    .then((recipe) => {
      if (!recipe) {
        next(new Error('Recipe not found'));
      }
      return recipe.update(req.body);
    })
    .then(updatedRecipe => res.send(updatedRecipe))
    .catch(next);
});

router.delete('/:id', (req, res, next) => {
  req.user.removeSavedRecipe(req.params.id)
    .then(() => req.user.removeGroceryListRecipe(req.params.id))
    .then(() => res.sendStatus(204))
    .catch(next);
});
