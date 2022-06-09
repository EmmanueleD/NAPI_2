async function main(){  
  const express = require('express')
  const cors = require('cors')
  const app = express()
  
  app.use(express.json())
  app.use(cors())

  app.get('/', (req, res)=>{
    res.send("Lobby path")
  })

  let port = process.env.PORT || 3590
  app.listen(port, ()=>{
    console.log("server up")
  })

  const mysql = require('mysql2/promise')

  const connection =  await mysql.createPool({
    host: 'us-cdbr-east-05.cleardb.net',
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  })

  // GET ALL INGREDIENTS
  app.get('/api/ingredients/', async (req, res)=>{

    const result = await connection.execute('SELECT * FROM ingredients')
    console.log(result[0])
    res.send(result[0])
  })

  
  // GET INGREDIENT BY ID
  app.get('/api/ingredients/:id', async (req, res)=>{
    const result = await connection.execute('SELECT i.id, i.name, i.price, i.qty FROM ingredients as i WHERE i.id = ?', [req.params.id])
    console.log(result[0])
    res.send(result[0])
  })

  // POST NEW INGREDIENT
  app.post('/api/ingredients/', async(req, res)=>{
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
  app.put('/api/ingredients/:id', async(req, res)=>{
    let data = {
      name: req.body.name,
      price: req.body.price,
      qty: req.body.qty
    }
    const result = await connection.execute('UPDATE ingredients SET name = ?, price = ? , qty = ? WHERE ingredients.id = ? ', [data.name, data.price, data.qty, req.params.id])
    res.send(result[0])
  })

  // DELETE EXISTING INGREDIENT
  app.delete('/api/ingredients/:id', async (req, res)=>{

    const result = await connection.execute('DELETE FROM ingredients WHERE ingredients.id = ?', [req.params.id])
    res.send(result[0])
  })

  // GET ALL RECIPES
  app.get('/api/recipes_simple/', async (req, res)=>{
    const result = await connection.execute('SELECT * FROM recipes')
    res.send(result[0])
  })

  // GET ALL RECIPES WITH INGREDIENTS
  app.get('/api/recipes_complete/', async(req, res)=> {
   let arr = []
   //get all ingredients for every recipe 
   const recipesWIngredients = await connection.execute('SELECT * FROM recipes_ingredients')

    // get prices for every ingredients in every recipe
    recipesWIngredients[0].forEach(async element => {
      const getIngredient = await connection.execute('SELECT ingredients.name, ingredients.price, ingredients.qty FROM ingredients WHERE ingredients.id = ?', [element.id_ingredient])
      const getRecipeName = await connection.execute('SELECT recipes.name FROM recipes WHERE recipes.id = ?', [element.id_recipe])
      
      element.recipe_name = getRecipeName[0][0].name
      element.ingredient = getIngredient[0][0]
      // element.price = getIngredient[0][0].price/getIngredient[0][0].qty*element.qty
      arr.push(element)
     
      let groupBy = (array, key) => {
        return array.reduce((result, obj) => {
           (result[obj[key]] = result[obj[key]] || []).push(obj);
           return result;
        }, {});
     };

      // // arr.length == recipesWIngredients[0].length ? res.send(arr) : null
      // if(arr.length == recipesWIngredients[0].length) {
      //  let a =  groupBy(arr, ["id_recipe"])
      //  res.send(a)
      // }  
    })  
    res.send(arr) 
  })

  // GET RECIPE BY ID
  app.get('/api/recipes_/:id', async (req, res)=>{

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
  app.post('/api/recipes_/', async (req, res)=>{
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
  app.put('/api/recipes_editname/:id', async (req, res) => {
    const result = await connection.execute('UPDATE recipes SET recipes.name=? WHERE recipes.id=?', 
    [req.body.name, req.params.id])
    res.send({
      newName: req.body.name,
      result: result[0]
    })
  })

  //               ~~~[ UPDATE INGREDIENT QUANTITY ]~~~
  app.put('/api/recipes_editingredient/:id_recipe/:id_ingredient/:qty', async (req, res) => {
    const result = await connection.execute('UPDATE recipes_ingredients  SET recipes_ingredients.qty=? WHERE recipes_ingredients.id_recipe=? AND recipes_ingredients.id_ingredient=?', 
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
  app.post('/api/recipes_addingredient/:id_recipe/:id_ingredient/:qty', async (req, res) => {
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
  app.delete('/api/recipes_deleteingredient/:id_recipe/:id_ingredient', async (req, res)=>{
    const result = await connection.execute('DELETE FROM recipes_ingredients  WHERE recipes_ingredients.id_recipe=? AND recipes_ingredients.id_ingredient=?', [req.params.id_recipe, req.params.id_ingredient])
    res.send({
      deletedIngredient:{
        id: req.params.id_ingredient,
        result: result[0]
      }
    })
  })

  // DELETE EXISTING RECIPE
  app.delete('/api/recipes_/:id', async (req, res)=> {
    const deleteRecipe = await connection.execute('DELETE FROM recipes WHERE id=?', [req.params.id])
    const deleteIngredients = await connection.execute('DELETE FROM recipes_ingredients WHERE id_recipe=?', [req.params.id])
    res.send({
      recipeDeleted: deleteRecipe[0].affectedRows == 1 ? true : false,
      ingredientsInRecipe: deleteIngredients[0].affectedRows > 0 ? deleteIngredients[0].affectedRows : false
    })
  })
}
main()