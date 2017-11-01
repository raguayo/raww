/* global describe beforeEach it before after */

import mockAxios from "../../../mockAdapter";
import * as peapodModule from "../../../../peapod/mapToPeapod";
import {
  validateIngredientProperties,
  validateRecipeProperties,
} from './utils/validatePost';

const { expect } = require("chai");
const request = require("supertest");
const sinon = require("sinon");
const app = require("../../../../server");

const {
  Recipe,
  User,
  Ingredient,
  PeapodIngredient,
} = require("../../../../server/db/models");

const sampleAPIData = require("./sampleAPIData");

describe("Recipes API", () => {
  describe("/api/recipes", () => {
    describe("/:url", () => {
      describe("POST /:url", () => {
        let agent;
        let recipe;
        const newRecipeUrl =
          "http://www.melskitchencafe.com/the-best-fudgy-brownies/";
        let stub;

        before("mock api", () => {
          const formattedUrl = newRecipeUrl
            .replace(":", "%3A")
            .replace("/", "%2F");
          mockAxios
            .onGet(`/recipes/extract?forceExtraction=false&url=${formattedUrl}`)
            .reply(200, sampleAPIData);
        });

        before("stub mapToPeapod", () => {
          const createPeapodIngHOF = () => {
            let counter = 0;
            return () => {
              counter += 1;
              return PeapodIngredient.findOrCreate({
                where: {
                  prodId: counter
                },
                defaults: {
                  name: "test",
                  price: 2.2,
                  size: 12
                }
              });
            };
          };
          stub = sinon
            .stub(peapodModule, "mapToPeapod")
            .callsFake(createPeapodIngHOF());
        });

        after("restore stub", () => {
          stub.restore();
        });

        beforeEach("create seed data", async () => {
          recipe = await Recipe.create({
            title: "Test Recipe",
            recipeUrl: "testrecipe.com"
          });
          const ingredients = await Promise.all([
            Ingredient.create({ name: "carrots" }),
            Ingredient.create({ name: "celery" })
          ]);
          const prevUser = {
            name: "Previous User",
            email: "prev@prev.com",
            password: "prev"
          };
          const loggedInUser = {
            name: "Tester McTestson",
            email: "tester@test.com",
            password: "test"
          };
          const createdPrevUser = await User.create(prevUser);
          await User.create(loggedInUser);
          await recipe.addIngredients(ingredients);
          await createdPrevUser.addSavedRecipe(recipe);
          agent = request.agent(app);
          return agent.post("/auth/login").send(loggedInUser);
        });

        describe("requests from chrome extension", () => {
          it("posts new recipes", async () => {
            const res = await agent
            .post("/api/recipes/chrome")
            .send({
              isFromChromeExt: true,
              recipe: sampleAPIData,
              inGroceryList: "false"
            })
            .expect(201);
            validateRecipeProperties(res, expect);
            validateIngredientProperties(res, expect);
          });

          it("finds existing recipes", async () => {
            const res = await agent
              .post("/api/recipes/chrome")
              .send({
                isFromChromeExt: true,
                recipe: recipe.dataValues,
                inGroceryList: "false"
              })
              .expect(201);
            expect(res.body).to.be.an("object");
            expect(res.body.savedRecipe).to.be.an("array");
            expect(res.body.savedRecipe).to.be.an("array");
            expect(res.body.savedRecipe[0].title).to.be.equal("Test Recipe");
            expect(res.body.savedRecipe[0].ingredients).to.be.an("array");
            expect(res.body.savedRecipe[0].ingredients[0].name).to.be.oneOf([
              "carrots",
              "celery"
            ]);
          });
        });

        describe("requests from web app", () => {
          it("posts new recipes", async () => {
            const formattedUrl = newRecipeUrl
              .replace(":", "%3A")
              .split("/")
              .join("%2F");
            const res = await agent
              .post(`/api/recipes/${formattedUrl}`)
              .expect(201);

            validateRecipeProperties(res, expect);
            validateIngredientProperties(res, expect);
          });

          it("finds existing recipes", async () => {
            const url = "testrecipe.com";
            const res = await agent.post(`/api/recipes/${url}`).expect(201);
            expect(res.body).to.be.an("object");
            expect(res.body.savedRecipe).to.be.an("array");
            expect(res.body.savedRecipe[0].title).to.be.equal("Test Recipe");
            expect(res.body.savedRecipe[0].ingredients).to.be.an("array");
            expect(res.body.savedRecipe[0].ingredients[0].name).to.be.oneOf([
              "carrots",
              "celery"
            ]);
          });
        });
      });
    });
  });
});
