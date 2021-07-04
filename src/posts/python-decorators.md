---
title: "A simple example of Python decorators: Logging function arguments"
date: 2021-07-04
tags:
  - post
  - coding
  - python
layout: layouts/post.njk
---

Decorators in Python were an advanced mystery to me when I first started out coding. I stayed away from them longer than was good for me, as I always felt like it was vodoo magic. But decorators are nothing syntactic sugar to call a higher-order functions on the decorated function. A higher-order function is roughly defined as a function that takes at least one other function as an argument or which returns a function.

So let's explore this abstract concept with an example I find really helpful: logging the arguments of a function. One way is to modify the function we want to log the arguments of directly. But this is pretty cumbersome to do and requires us to modify a lot of functions. Another way is to write a decorator for it!

Let's start with a simple function we want to log:

```python
def sum(a: int, b: int) -> int:
    return a + b
```

To define a decorator we define a function that takes the decorated function as its first argument:

```python
from typing import Callable

def logging_decorator(decorated_function: Callable):
    pass
```

We then define a wrapper function inside our decorator that does the logging. Our wrapper function just tages a generic list of arguments `args` and a dictionary of keyword arguments `kwargs`. Those we print out (our logging) and then return our decorated function `decorated_function` results by calling it with the given `args` and `kwargs`:

```python
def logging_decorator(decorated_function: Callable) -> Callable:
    def wrapper_function(*args, **kwargs):
        print(f"arguments: {args}")
        print(f"keyword arguments: {kwargs}")
        return decorated_function(*args, **kwargs)
    return wrapper_function
```

We can now decorate our `sum` function with the logging decorator and run it

```python
@logging_decorator
def sum(a: int, b: int) -> int:
    return a + b


if __name__ == "__main__":
    sum(42, 10)
```

Running this will result in the following output:

```text
arguments: (42, 10)
keyword arguments: {}
```

What we end up doing is that we actually don't directly call the `sum` function, but rather we call the `logging_decorator` function with our `sum` function as its input argument `decorated_function`. Calling the `logging_decorator` function will now return our `wrapper_function`, which will run our print statements and our decorated `sum` function - and it's the actual function we are calling.

Alright, to make our logging decorator more useful we can add some bells and whistles to it. For example printing the name of the called function:

```python
def logging_decorator(decorated_function: Callable) -> Callable:
    def wrapper_function(*args, **kwargs):
        print(f"function: {decorated_function.__name__}")
        print(f"arguments: {args}")
        print(f"keyword arguments: {kwargs}")
        return decorated_function(*args, **kwargs)
    return wrapper_function
```

```text
function: sum
arguments: (42, 10)
keyword arguments: {}
```

```python
def logging_decorator(decorated_function: Callable) -> Callable:
    def wrapper_function(*args, **kwargs):
        name = decorated_function.__name__
        print(f"{name}({', '.join([str(arg) for arg in args])})")
        return decorated_function(*args, **kwargs)
    return wrapper_function
```

```text
sum(42, 10)
```

Alright, we can expand on this to also print out the keyword arguments of a function and its return value. For that we actually run the `decorated_function` inside our wrapper function and return the resulting value.

```python
def logging_decorator(decorated_function: Callable) -> Callable:
    def wrapper_function(*args, **kwargs):
        name = decorated_function.__name__
        arguments = ', '.join([str(arg) for arg in args])
        keyword_arguments = ', '.join([f'{k}={v}' for k, v in kwargs.items()])
        results = decorated_function(*args, **kwargs)
        print(f"{name}({arguments}, {keyword_arguments}) -> {results}")
        return results
    return wrapper_function
```

To demonstrate I've added a keyword argument to the `sum` function for an optional third summation parameter:

```python
@logging_decorator
def sum(a: int, b: int, c: int = 0) -> int:
    return a + b + c


if __name__ == "__main__":
    sum(42, 10, c=9)
    sum(0, 5, c=-4)
    sum(9, 1)
```

Which will give us the following:

```text
sum(42, 10, c=9) -> 61
sum(0, 5, c=-4) -> 1
sum(9, 1, ) -> 10
```

There's still a lot of room to improve this, for example to actually use a `logger` to log rather than just printing to the standard output. Another improvement would be to also log the types of the (keyword) arguments.

Now I hope this example of a logging decorator helped your understanding of how Python decorators work.
