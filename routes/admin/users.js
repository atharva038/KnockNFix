router.get('/admin/users/:id', async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    res.render('pages/admin/viewUser', { user });
});