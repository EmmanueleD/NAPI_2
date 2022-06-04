async function main(){  
  const express = require('express')
  const app = express()
  
  app.use(express.json())

  app.get('/', (req, res)=>{
    res.send("Lobby path")
  })

  let port = 3000
  app.listen(port, ()=>{
    console.log("server up at port: "+ port+" [ http://localhost:"+port+' ]')
  })



  const mysql = require('mysql2/promise')
  // const bluebird = require('bluebird')

  const connection =  await mysql.createConnection({
    host: 'localhost',
    user: 'emmanuele',
    password: 'password',
    database: 'recipe-cost-calculator',
    // Promise: bluebird
  })

  // GET ALL INGREDIENTS
  app.get('/api/getIngredients/', async (req, res)=>{

    const result = await connection.execute('SELECT * FROM ingredients')
    console.log(result[0])
    res.send(result[0])
  })

  
  // GET INGREDIENT BY ID
  app.get('/api/getIngredient/:id', async (req, res)=>{
    const result = await connection.execute('SELECT i.id, i.name, i.price, i.qty FROM ingredients as i WHERE i.id = ?', [req.params.id])
    console.log(result[0])
    res.send(result[0])
  })

  // POST NEW INGREDIENT
  app.post('/api/postIngredient/', async(req, res)=>{
    let data = {
      name: req.body.name,
      price: req.body.price,
      qty: req.body.qty
    }
    const result = await connection.execute('INSERT INTO ingredients (name, price, qty) VALUES (?, ?, ?)', [data.name, data.price, data.qty])
    console.log(data, result[0])
    res.send(data)
  })

  // PUT EXISTING INGREDIENT
  app.put('/api/putIngredient/:id', async(req, res)=>{
    let data = {
      name: req.body.name,
      price: req.body.price,
      qty: req.body.qty
    }
    const result = await connection.execute('UPDATE ingredients SET name = ?, price = ? , qty = ? WHERE ingredients.id = ? ', [data.name, data.price, data.qty, req.params.id])
    res.send(result[0])
  })

  // DELETE EXISTING INGREDIENT
  app.delete('/api/deleteIngredient/:id', async (req, res)=>{

    const result = await connection.execute('DELETE FROM ingredients AS i WHERE i.id = ?', [req.params.id])
    res.send(result[0])
  })

  // GET ALL RECIPES
  app.get('/api/getRecipes/', async (req, res)=>{
    const result = await connection.execute('SELECT * FROM recipes')
    res.send(result[0])
  })

  // GET ALL RECIPES WITH INGREDIENTS
  app.get('/api/getRecipesWIngredients/', async(req, res)=> {
   let arr = []
   //get all ingredients for every recipe 
   const recipesWIngredients = await connection.execute('SELECT * FROM recipes_ingredients')

    // get prices for every ingredients in every recipe
    recipesWIngredients[0].forEach(async element => {
      const getIngredient = await connection.execute('SELECT i.name, i.price, i.qty FROM ingredients as i WHERE i.id = ?', [element.id_ingredient])
      const getRecipeName = await connection.execute('SELECT recipes.name FROM recipes WHERE recipes.id = ?', [element.id_recipe])
      
      element.recipe_name = getRecipeName[0][0].name
      element.ingredient = getIngredient[0][0]
      element.price = getIngredient[0][0].price/getIngredient[0][0].qty*element.qty
      arr.push(element)
     
      let groupBy = (array, key) => {
        return array.reduce((result, obj) => {
           (result[obj[key]] = result[obj[key]] || []).push(obj);
           return result;
        }, {});
     };

      // arr.length == recipesWIngredients[0].length ? res.send(arr) : null
      if(arr.length == recipesWIngredients[0].length) {
       let a =  groupBy(arr, ["id_recipe"])
       res.send(a)
      }  
    })   
  })

  // GET RECIPE BY ID
  app.get('/api/getRecipe/:id', async (req, res)=>{

    const result = await connection.execute('SELECT r.id AS ID_recipe, r.name AS NAME_recipe, i.id AS ID_ingredient, i.name AS NAME_ingredient, ri.qty AS QTY_ingredient FROM recipes AS r JOIN recipes_ingredients AS ri ON ri.id_recipe = r.id JOIN ingredients AS i ON i.id = ri.id_ingredient WHERE r.id = ?', [req.params.id])

    let response = {
      ID_recipe: result[0][0].ID_recipe,
      NAME_recipe: result[0][0].NAME_recipe,
      ingredients: []
    }
    result[0].forEach(element => {
      response.ingredients.push({
        ID_ingredient: element.ID_ingredient,
        NAME_ingredient: element.NAME_ingredient,
        QTY_ingredient: element.QTY_ingredient
      })
    })
    res.send(response)
  })

  //POST NEW RECIPE
  app.post('/api/postRecipe/', async (req, res)=>{
    let ingredientsQuery = "INSERT INTO recipes_ingredients (id_recipe, id_ingredient, qty) VALUES"
    let data = {
      name: req.body.name,
      ingredients: []
    }
    req.body.ingredients.forEach(element => {
      data.ingredients.push(element)
    })
    // create new recipe
    const newRecipe = await connection.execute('INSERT INTO recipes (name) VALUES (?)', [data.name])
    //get id of recipe just created
    const lastId = await connection.execute('SELECT LAST_INSERT_ID()')
    data.id = await lastId[0][0]["LAST_INSERT_ID()"]
    //set query to put all ingredients in recipe just created
    data.ingredients.forEach(element => {
      let nextIngredient = " (" + data.id +", "+element.id+", "+element.qty+" ),"
      ingredientsQuery += nextIngredient
    })
    const putIngredients = await connection.execute(ingredientsQuery.slice(0, -1)) 
    res.send(data)
  })

  //EDIT EXISTING RECIPE  
  //               ~~~[ UPDATE RECIPE NAME ]~~~
  app.put('/api/editRacipeName/:id', async (req, res) => {
    const result = await connection.execute('UPDATE recipes as r SET r.name=? WHERE r.id=?', 
    [req.body.name, req.params.id])
    res.send({
      newName: req.body.name,
      result: result[0]
    })
  })

  //               ~~~[ UPDATE INGREDIENT QUANTITY ]~~~
  app.put('/api/editIngredientQty/:id_recipe/:id_ingredient/:qty', async (req, res) => {
    const result = await connection.execute('UPDATE recipes_ingredients as ri SET ri.qty=? WHERE ri.id_recipe=? AND ri.id_ingredient=?', 
    [req.params.qty, req.params.id_recipe, req.params.id_ingredient])
    res.send({
      editedIngredient:{
        id: req.params.id_ingredient,
        qty: req.params.qty
      },
      result: result[0]
    })
  })

  //               ~~~[ INSERT NEW INGREDIENT ]~~~
  app.post('/api/insertNewIngredient/:id_recipe/:id_ingredient/:qty', async (req, res) => {
    const result = await connection.execute('INSERT INTO recipes_ingredients (id_recipe, id_ingredient, qty) VALUES (?, ?, ?)', 
    [req.params.id_recipe, req.params.id_ingredient, req.params.qty])
    res.send({
      addedIngredient:{
        id: req.params.id_ingredient,
        result: result[0]
      }
    })
  })

  //               ~~~[ DELETE INGREDIENT ]~~~
  app.delete('/api/deleteIngredient/:id_recipe/:id_ingredient', async (req, res)=>{
    const result = await connection.execute('DELETE FROM recipes_ingredients as ri WHERE ri.id_recipe=? AND ri.id_ingredient=?', [req.params.id_recipe, req.params.id_ingredient])
    res.send({
      deletedIngredient:{
        id: req.params.id_ingredient,
        result: result[0]
      }
    })
  })

  // DELETE EXISTING RECIPE
  app.delete('/api/deleteRecipe/:id', async (req, res)=> {
    const deleteRecipe = await connection.execute('DELETE FROM recipes WHERE id=?', [req.params.id])
    const deleteIngredients = await connection.execute('DELETE FROM recipes_ingredients WHERE id_recipe=?', [req.params.id])
    res.send({
      recipeDeleted: deleteRecipe[0].affectedRows == 1 ? true : false,
      ingredientsInRecipe: deleteIngredients[0].affectedRows > 0 ? deleteIngredients[0].affectedRows : false
    })
  })
}
main()