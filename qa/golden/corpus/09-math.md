# Convergence Notes on the Semi-Implicit Integrator

## Purpose and summary

This note records the convergence analysis behind the semi-implicit integrator
adopted in revision four of the simulation core. The route is the standard one:
state the discrete update rule, pass to the continuous limit, and bound the
accumulated error. Throughout, the state at step $k$ is written $x_k$, the
step size is $h$, and the damping coefficient is $\zeta$; the angular
frequency is $\omega$ and the decay rate is $\lambda$. Superscripts in
parentheses such as $x^{(n)}$ denote iterates of the inner solve, never
powers; a plain exponent such as $h^2$ always means a power. Where the Greek
alphabet appears -- $\alpha$, $\beta$, $\gamma$, $\epsilon$ and the capitals
$\Gamma$ and $\Omega$ -- it is used exactly as in the reference textbook, so
the two can be read side by side without a translation table.

## Assumptions and notation

The analysis rests on three assumptions, each of which the implementation
checks at run time and refuses to proceed without:

- The right-hand side $f(x, t)$ is Lipschitz in its first argument with
  constant $L$, so that $\|f(a, t) - f(b, t)\| \le L\,\|a - b\|$ holds for
  every admissible pair of states $a$ and $b$.
- The step size $h = t_{k+1} - t_k$ is held constant across a run. Adaptive
  stepping is out of scope for this note and is analysed separately.
- The integrator is seeded with the exact state, so the initial error
  satisfies $e_0 = 0$ and every later error term is attributable to the
  scheme itself rather than to the data it was given.

## The discrete update rule

One step of the scheme advances the pair $(x_k, v_k)$ by first relaxing the
velocity and then moving the position with the relaxed value. Written out in
full, the position update is the weighted mean

$$x_{k+1} = \frac{x_k + h\,v_{k+1}}{1 + \zeta h}$$

and the displacement accumulated over a run of $N$ steps is the sum

$$S_N = \sum_{k=0}^{N-1} h\,f(x_k, t_k)$$

which the code evaluates in compensated arithmetic, so that the rounding error
of the summation itself stays comfortably below the truncation error of the
scheme and never disturbs the measured order of convergence.

## The continuous limit

As $h \to 0$ the discrete trajectory converges to the solution of the
underlying initial value problem, which in integral form reads

$$u(t) = u(0) + \int_0^{t} f(u(s), s)\,ds$$

The exponential test problem makes the limit concrete. With
$f(u, t) = -\lambda u$ the exact solution decays as $u(t) = u_0 e^{-\lambda t}$,
and the total area under the decay curve is finite:

$$\int_0^\infty e^{-\lambda t}\,dt = \frac{1}{\lambda}$$

Every convergence figure quoted later in this note was produced against this
problem, because its closed form removes any doubt about what the exact
answer ought to be.

## Matrix form of one step

Collecting position and velocity into a single state vector lets one step of
the scheme be written as a matrix product. The update matrix is

$$A(h) = \begin{pmatrix} 1 - \lambda h & h \\ -\zeta h & 1 \end{pmatrix}$$

and the state advances as

$$\begin{bmatrix} x_{k+1} \\ v_{k+1} \end{bmatrix} = A(h) \begin{bmatrix} x_k \\ v_k \end{bmatrix}$$

The spectral radius $\rho(A)$ governs everything that follows: **the scheme is
stable precisely when $\rho(A) \le 1$**, and the implementation refuses a step
size that violates this bound rather than integrating on and letting the state
grow without complaint.

## Error propagation

Let $e_k = x_k - u(t_k)$ denote the global error at step $k$, and let $\tau_k$
be the local truncation error committed on that step. Subtracting the exact
propagation from the discrete one and applying the triangle inequality gives a
recursion that telescopes cleanly:

$$
\begin{aligned}
e_{k+1} &= A(h)\,e_k + h\,\tau_k \\
\|e_{k+1}\| &\le \|A(h)\|\,\|e_k\| + C\,h^{3} \\
\|e_N\| &\le \frac{C\,h^{2}}{\lambda}\left(1 - e^{-\lambda T}\right)
\end{aligned}
$$

The method is therefore second order: halving the step size quarters the
error, which is exactly the slope the acceptance tests assert on a log-log
plot of error against step size.

## The practical stability bound

The bound on the step size deserves a short derivation of its own, because the
constant in front of it is the one the configuration file exposes and the one
that has been mistuned twice in the project's history. The characteristic
polynomial of $A(h)$ has complex roots whenever the damping is subcritical,
and the modulus of those roots crosses one at a step size that depends on the
stiffness and the damping together, not on either alone. Working the algebra
through -- expanding the determinant, discarding the term that is fourth order
in $h$, and solving the resulting quadratic for the largest admissible step --
produces the expression that the scheduler enforces on every run:

$$h_{\max} = \frac{2\,\zeta\,\omega}{\omega^{2} + \zeta^{2}}$$

Note that the bound is symmetric in $\zeta$ and $\omega$ and reaches its
maximum where the two coincide, which matches the folklore advice that the
integrator is happiest when damping and frequency are of the same order.

## Conclusion

For the parameter ranges the product actually ships -- $\zeta$ between
$10^{-2}$ and $10^{1}$, and $\omega$ up to $10^{3}$ -- the measured error
tracks the bound $C\,h^{2}$ with a constant $C$ within a factor of two of the
derived value, and no production run has yet been observed outside it.
